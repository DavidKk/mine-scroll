import { isDev } from '../../env.ts'

const PREFIX = '[minesweeper]'

export function devLog(message: string, ...details: unknown[]): void {
  if (!isDev) return
  if (details.length === 0) console.debug(PREFIX, message)
  else console.debug(PREFIX, message, ...details)
}

export function devWarn(message: string, ...details: unknown[]): void {
  if (!isDev) return
  if (details.length === 0) console.warn(PREFIX, message)
  else console.warn(PREFIX, message, ...details)
}
