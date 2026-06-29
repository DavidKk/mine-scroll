/** Server ranked/leaderboard APIs when KV is not linked (503). */
export function isRankedStorageUnavailableMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  return normalized.includes('not configured') || normalized.includes('link vercel kv')
}
