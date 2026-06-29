export interface KvRestCredentials {
  url: string
  token: string
}

const KV_URL_SUFFIX = '_KV_REST_API_URL'
const KV_TOKEN_SUFFIX = '_KV_REST_API_TOKEN'

/** Resolve Upstash / Vercel KV REST credentials from process env. */
export function resolveKvRestCredentials(env: NodeJS.ProcessEnv = process.env): KvRestCredentials | null {
  const directUrl = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL
  const directToken = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN
  if (directUrl && directToken) {
    return { url: directUrl, token: directToken }
  }

  for (const [key, url] of Object.entries(env)) {
    if (!key.endsWith(KV_URL_SUFFIX) || !url) continue
    const prefix = key.slice(0, -KV_URL_SUFFIX.length)
    const token = env[`${prefix}${KV_TOKEN_SUFFIX}`]
    if (token) return { url, token }
  }

  return null
}

export function hasKvRestCredentials(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolveKvRestCredentials(env) !== null
}
