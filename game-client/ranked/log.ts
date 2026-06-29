import { brandLogPrefix } from '../../lib/brand.ts'
import { isDev } from '../env.ts'

const PREFIX = brandLogPrefix('ranked')

export function rankedWarn(message: string, ...details: unknown[]): void {
  if (!isDev) return
  if (details.length === 0) console.warn(PREFIX, message)
  else console.warn(PREFIX, message, ...details)
}
