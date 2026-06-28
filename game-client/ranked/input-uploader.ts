import { rankedWarn } from './log.ts'
import type { RunInputEvent } from './types.ts'

export interface RankedInputUploader {
  bindRun(runId: string): void
  queue(events: RunInputEvent[]): void
  flush(): Promise<void>
  dispose(): void
}

export function createRankedInputUploader(intervalMs = 30_000): RankedInputUploader {
  let runId: string | null = null
  let seq = 0
  const pending: RunInputEvent[] = []
  let inflight: Promise<void> | null = null
  let timerId: number | null = null

  async function uploadBatch(batch: RunInputEvent[]): Promise<void> {
    if (!runId || batch.length === 0) return
    const nextSeq = ++seq
    const response = await fetch(`/api/ranked/runs/${runId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seq: nextSeq, events: batch }),
    })
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      throw new Error(body?.error ?? 'Failed to upload ranked events')
    }
  }

  async function flushInternal(): Promise<void> {
    if (!runId || pending.length === 0) return
    const batch = pending.splice(0, pending.length)
    try {
      await uploadBatch(batch)
    } catch (error) {
      pending.unshift(...batch)
      throw error
    }
  }

  function schedule(): void {
    if (timerId !== null) return
    timerId = window.setInterval(() => {
      void flushInternal().catch((error) => {
        rankedWarn(error instanceof Error ? error.message : 'Ranked event upload failed')
      })
    }, intervalMs)
  }

  return {
    bindRun(nextRunId) {
      runId = nextRunId
      seq = 0
      pending.length = 0
      schedule()
    },
    queue(events) {
      if (events.length === 0) return
      pending.push(...events)
    },
    async flush() {
      if (inflight) {
        await inflight
      }
      inflight = flushInternal().finally(() => {
        inflight = null
      })
      await inflight
    },
    dispose() {
      if (timerId !== null) {
        window.clearInterval(timerId)
        timerId = null
      }
      runId = null
      pending.length = 0
    },
  }
}
