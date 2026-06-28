import { createLogger } from '../logger/index.ts'

export const logger = createLogger('ranked')

export function shortRunId(runId: string): string {
  return runId.slice(0, 8)
}

export function shortPlayerId(playerId: string): string {
  return playerId.slice(0, 8)
}
