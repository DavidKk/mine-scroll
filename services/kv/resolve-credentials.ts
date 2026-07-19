export interface KvRestCredentials {
  url: string
  token: string
}

/**
 * Resolve MineScroll KV / Redis REST credentials.
 *
 * Prefers REST API URL + write token. Falls back to `MINE_SCROLL_KV_URL` /
 * `MINE_SCROLL_REDIS_URL` for the URL, and the read-only token when the write
 * token is unset.
 */
export function resolveKvRestCredentials(env: NodeJS.ProcessEnv = process.env): KvRestCredentials | null {
  const url = env.MINE_SCROLL_KV_REST_API_URL ?? env.MINE_SCROLL_KV_URL ?? env.MINE_SCROLL_REDIS_URL
  const token = env.MINE_SCROLL_KV_REST_API_TOKEN ?? env.MINE_SCROLL_KV_REST_API_READ_ONLY_TOKEN
  if (!url || !token) return null
  return { url, token }
}

export function hasKvRestCredentials(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolveKvRestCredentials(env) !== null
}
