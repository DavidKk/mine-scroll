import assert from 'node:assert/strict'

import { hasKvRestCredentials, resolveKvRestCredentials } from '../services/kv/resolve-credentials.ts'

export function testResolveKvRestApiEnv(): void {
  const creds = resolveKvRestCredentials({
    MINE_SCROLL_KV_REST_API_URL: 'https://mine-scroll.upstash.io',
    MINE_SCROLL_KV_REST_API_TOKEN: 'write-token',
  })
  assert.deepEqual(creds, { url: 'https://mine-scroll.upstash.io', token: 'write-token' })
}

export function testResolveKvUrlFallback(): void {
  const creds = resolveKvRestCredentials({
    MINE_SCROLL_KV_URL: 'https://kv-url.upstash.io',
    MINE_SCROLL_KV_REST_API_TOKEN: 'write-token',
  })
  assert.deepEqual(creds, { url: 'https://kv-url.upstash.io', token: 'write-token' })
}

export function testResolveKvRedisUrlFallback(): void {
  const creds = resolveKvRestCredentials({
    MINE_SCROLL_REDIS_URL: 'https://redis-url.upstash.io',
    MINE_SCROLL_KV_REST_API_READ_ONLY_TOKEN: 'read-token',
  })
  assert.deepEqual(creds, { url: 'https://redis-url.upstash.io', token: 'read-token' })
}

export function testResolveKvPrefersRestUrlAndWriteToken(): void {
  const creds = resolveKvRestCredentials({
    MINE_SCROLL_KV_REST_API_URL: 'https://rest.upstash.io',
    MINE_SCROLL_KV_URL: 'https://kv.upstash.io',
    MINE_SCROLL_REDIS_URL: 'https://redis.upstash.io',
    MINE_SCROLL_KV_REST_API_TOKEN: 'write-token',
    MINE_SCROLL_KV_REST_API_READ_ONLY_TOKEN: 'read-token',
  })
  assert.deepEqual(creds, { url: 'https://rest.upstash.io', token: 'write-token' })
}

export function testResolveKvIgnoresLegacyEnv(): void {
  assert.equal(
    resolveKvRestCredentials({
      KV_REST_API_URL: 'https://legacy.upstash.io',
      KV_REST_API_TOKEN: 'legacy-token',
      UPSTASH_REDIS_REST_URL: 'https://upstash.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'upstash-token',
    }),
    null
  )
}

export function testResolveKvMissingReturnsNull(): void {
  assert.equal(resolveKvRestCredentials({}), null)
  assert.equal(hasKvRestCredentials({}), false)
}
