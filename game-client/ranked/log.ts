import { isDev } from '../env.ts'

export function rankedWarn(message: string, ...details: unknown[]): void {
  if (!isDev) return
  if (details.length === 0) console.warn('[minesweeper ranked]', message)
  else console.warn('[minesweeper ranked]', message, ...details)
}
