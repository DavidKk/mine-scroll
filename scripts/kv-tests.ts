import assert from 'node:assert/strict'

import { hasKvRestCredentials, resolveKvRestCredentials } from '../services/kv/resolve-credentials.ts'

export function testResolveKvDirectEnv(): void {
  const creds = resolveKvRestCredentials({
    KV_REST_API_URL: 'https://direct.upstash.io',
    KV_REST_API_TOKEN: 'direct-token',
  })
  assert.deepEqual(creds, { url: 'https://direct.upstash.io', token: 'direct-token' })
}

export function testResolveKvPrefixedVercelEnv(): void {
  const creds = resolveKvRestCredentials({
    minescroll_KV_REST_API_URL: 'https://minescroll.upstash.io',
    minescroll_KV_REST_API_TOKEN: 'minescroll-token',
  })
  assert.deepEqual(creds, { url: 'https://minescroll.upstash.io', token: 'minescroll-token' })
}

export function testResolveKvPrefersDirectOverPrefixed(): void {
  const creds = resolveKvRestCredentials({
    KV_REST_API_URL: 'https://direct.upstash.io',
    KV_REST_API_TOKEN: 'direct-token',
    minescroll_KV_REST_API_URL: 'https://minescroll.upstash.io',
    minescroll_KV_REST_API_TOKEN: 'minescroll-token',
  })
  assert.deepEqual(creds, { url: 'https://direct.upstash.io', token: 'direct-token' })
}

export function testResolveKvMissingReturnsNull(): void {
  assert.equal(resolveKvRestCredentials({}), null)
  assert.equal(hasKvRestCredentials({}), false)
}
