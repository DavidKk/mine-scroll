'use client'

import { useCallback, useEffect, useState } from 'react'

import { AdminBackdrop } from '@/app/components/admin-backdrop'
import { cn } from '@/lib/cn'
import { LOGIN_PAGE_SHELL } from '@/lib/login-shell'

interface LeaderboardEntryRow {
  id: string
  playerId?: string
  name: string
  score: number
  depth?: number
  countryCode?: string
  submittedAt: number
}

interface DraftRow {
  name: string
  score: string
  depth: string
}

const btnBase =
  'inline-flex h-[34px] items-center justify-center rounded-lg border px-3 text-[0.78rem] tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50'
const inputBase =
  'box-border w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-xs text-admin-text focus:border-admin-cyan/40 focus:outline-none focus:ring-2 focus:ring-admin-cyan/10'

function formatSubmittedAt(timestamp: number): string {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function toDraft(entry: LeaderboardEntryRow): DraftRow {
  return {
    name: entry.name,
    score: String(entry.score),
    depth: String(entry.depth ?? 0),
  }
}

export function LeaderboardAdminClient() {
  const [entries, setEntries] = useState<LeaderboardEntryRow[]>([])
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({})
  const [updatedAt, setUpdatedAt] = useState(0)
  const [storage, setStorage] = useState<string>('none')
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const applyBoard = useCallback((body: { entries?: LeaderboardEntryRow[]; updatedAt?: number }) => {
    const rows = body.entries ?? []
    setEntries(rows)
    setDrafts(Object.fromEntries(rows.map((entry) => [entry.id, toDraft(entry)])))
    setUpdatedAt(body.updatedAt ?? 0)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/admin/leaderboard', { method: 'GET' })
      const body = (await response.json().catch(() => null)) as {
        error?: string
        entries?: LeaderboardEntryRow[]
        updatedAt?: number
        storage?: string
      } | null
      if (!response.ok) throw new Error(body?.error ?? 'Failed to load leaderboard')
      applyBoard(body ?? {})
      setStorage(body?.storage ?? 'none')
      setStatus(`${body?.entries?.length ?? 0} entries`)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load leaderboard')
    } finally {
      setLoading(false)
    }
  }, [applyBoard])

  useEffect(() => {
    void load()
  }, [load])

  function updateDraft(id: string, field: keyof DraftRow, value: string) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id]!, [field]: value },
    }))
  }

  async function saveRow(id: string) {
    const draft = drafts[id]
    if (!draft) return

    setBusyId(id)
    setError('')
    setStatus('Saving…')
    try {
      const response = await fetch('/api/admin/leaderboard', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: draft.name,
          score: Number(draft.score),
          depth: Number(draft.depth),
        }),
      })
      const body = (await response.json().catch(() => null)) as {
        error?: string
        entries?: LeaderboardEntryRow[]
        updatedAt?: number
      } | null
      if (!response.ok) throw new Error(body?.error ?? 'Failed to save entry')
      applyBoard(body ?? {})
      setStatus('Entry saved.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save entry')
      setStatus('')
    } finally {
      setBusyId(null)
    }
  }

  async function deleteRow(id: string) {
    if (!window.confirm('Delete this leaderboard entry?')) return

    setBusyId(id)
    setError('')
    setStatus('Deleting…')
    try {
      const response = await fetch('/api/admin/leaderboard', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const body = (await response.json().catch(() => null)) as {
        error?: string
        entries?: LeaderboardEntryRow[]
        updatedAt?: number
      } | null
      if (!response.ok) throw new Error(body?.error ?? 'Failed to delete entry')
      applyBoard(body ?? {})
      setStatus('Entry deleted.')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete entry')
      setStatus('')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <main className={cn(LOGIN_PAGE_SHELL, 'block overflow-auto')}>
      <AdminBackdrop />
      <div className="relative z-[1] mx-auto w-full max-w-[1120px] px-5 py-6 pb-10">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.12em] text-admin-muted">Admin</p>
            <h1 className="text-2xl font-bold">Leaderboard</h1>
            <p className="mt-1.5 text-sm text-admin-muted">
              Storage: {storage}
              {updatedAt > 0 ? ` · Updated ${formatSubmittedAt(updatedAt)}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <a className={`${btnBase} border-white/10 bg-white/5 text-admin-text no-underline hover:border-admin-cyan/40 hover:bg-admin-cyan/10`} href="/admin/assets/sources">
              Back to admin
            </a>
            <button
              type="button"
              className={`${btnBase} border-white/10 bg-white/5 text-admin-text hover:border-admin-cyan/40 hover:bg-admin-cyan/10`}
              onClick={() => void load()}
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </div>

        {status ? <p className="mb-3.5 text-sm text-admin-muted">{status}</p> : null}
        {error ? <p className="mb-3.5 text-sm text-red-300">{error}</p> : null}

        <section className="overflow-hidden rounded-xl border border-white/10 bg-admin-panel">
          {loading ? (
            <p className="px-4 py-12 text-center text-admin-muted">Loading leaderboard…</p>
          ) : entries.length === 0 ? (
            <p className="px-4 py-12 text-center text-admin-muted">No leaderboard entries yet.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    {['#', 'ID', 'Region', 'Name', 'Score', 'Depth', 'Submitted', 'Actions'].map((label) => (
                      <th
                        key={label}
                        className="sticky top-0 z-[1] whitespace-nowrap bg-[rgba(8,12,22,0.98)] px-3 py-2.5 text-[0.66rem] uppercase tracking-[0.08em] text-admin-muted"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => {
                    const draft = drafts[entry.id] ?? toDraft(entry)
                    const busy = busyId === entry.id
                    return (
                      <tr key={entry.id} className="border-b border-white/10 last:border-b-0">
                        <td className="px-3 py-2.5 tabular-nums text-admin-muted">{String(index + 1).padStart(2, '0')}</td>
                        <td className="max-w-[120px] truncate px-3 py-2.5 text-zinc-500" title={entry.playerId ?? entry.id}>
                          {(entry.playerId ?? entry.id).slice(0, 8)}…
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-admin-muted">{entry.countryCode ?? '—'}</td>
                        <td className="px-3 py-2.5">
                          <input
                            className={`${inputBase} min-w-[140px]`}
                            value={draft.name}
                            maxLength={24}
                            onChange={(event) => updateDraft(entry.id, 'name', event.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            className={`${inputBase} max-w-24`}
                            value={draft.score}
                            inputMode="numeric"
                            onChange={(event) => updateDraft(entry.id, 'score', event.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            className={`${inputBase} max-w-24`}
                            value={draft.depth}
                            inputMode="numeric"
                            onChange={(event) => updateDraft(entry.id, 'depth', event.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2.5">{formatSubmittedAt(entry.submittedAt)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              className={`${btnBase} border-admin-cyan/40 bg-admin-cyan/15 text-cyan-100 hover:brightness-110`}
                              disabled={busy}
                              onClick={() => void saveRow(entry.id)}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className={`${btnBase} border-red-400/45 text-red-200 hover:brightness-110`}
                              disabled={busy}
                              onClick={() => void deleteRow(entry.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
