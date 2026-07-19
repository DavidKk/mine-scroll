import { hasKvRestCredentials, resolveKvRestCredentials } from '@/services/kv/resolve-credentials'

describe('services/kv/resolve-credentials', () => {
  it('resolves REST API URL and write token', () => {
    expect(
      resolveKvRestCredentials({
        MINE_SCROLL_KV_REST_API_URL: 'https://mine-scroll.upstash.io',
        MINE_SCROLL_KV_REST_API_TOKEN: 'write-token',
      })
    ).toEqual({ url: 'https://mine-scroll.upstash.io', token: 'write-token' })
  })

  it('falls back through URL and token aliases', () => {
    expect(
      resolveKvRestCredentials({
        MINE_SCROLL_REDIS_URL: 'https://redis.upstash.io',
        MINE_SCROLL_KV_REST_API_READ_ONLY_TOKEN: 'read-token',
      })
    ).toEqual({ url: 'https://redis.upstash.io', token: 'read-token' })
  })

  it('ignores legacy KV env names', () => {
    expect(
      resolveKvRestCredentials({
        KV_REST_API_URL: 'https://legacy.upstash.io',
        KV_REST_API_TOKEN: 'legacy-token',
      })
    ).toBeNull()
    expect(hasKvRestCredentials({})).toBe(false)
  })
})
