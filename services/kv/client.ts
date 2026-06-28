/**
 * KV client wrapper (Upstash Redis).
 *
 * Production: `UPSTASH_REDIS_REST_*` or Vercel-linked `KV_REST_API_*`.
 * Local dev without env: shared in-process memory (globalThis + optional disk cache).
 */

import fs from 'node:fs'
import path from 'node:path'

import { Redis } from '@upstash/redis'

const GLOBAL_MEMORY_KEY = '__chill_kv_memory_store__'
const DEV_CACHE_FILE = path.join(process.cwd(), '.next/cache/chill-kv-memory.json')

let client: Redis | null = null
let devCacheLoaded = false
let devCachePersistTimer: ReturnType<typeof setTimeout> | null = null

interface MemoryEntry {
  payload: string
  expiresAt?: number
}

type MemoryStore = Map<string, MemoryEntry>

function hasRedisEnv(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  return Boolean(url && token)
}

function useMemoryStore(): boolean {
  return process.env.NODE_ENV === 'development' && !hasRedisEnv()
}

function getMemoryStore(): MemoryStore {
  const root = globalThis as typeof globalThis & { [GLOBAL_MEMORY_KEY]?: MemoryStore }
  if (!root[GLOBAL_MEMORY_KEY]) {
    root[GLOBAL_MEMORY_KEY] = new Map()
  }
  return root[GLOBAL_MEMORY_KEY]
}

function loadDevCacheFromDisk(): void {
  if (!useMemoryStore() || devCacheLoaded) return
  devCacheLoaded = true

  try {
    const raw = fs.readFileSync(DEV_CACHE_FILE, 'utf8')
    const parsed = JSON.parse(raw) as Record<string, MemoryEntry>
    const store = getMemoryStore()
    const now = Date.now()
    for (const [key, entry] of Object.entries(parsed)) {
      if (entry.expiresAt != null && entry.expiresAt <= now) continue
      store.set(key, entry)
    }
  } catch {
    // no dev cache yet
  }
}

function scheduleDevCachePersist(): void {
  if (!useMemoryStore()) return
  if (devCachePersistTimer) return
  devCachePersistTimer = setTimeout(() => {
    devCachePersistTimer = null
    try {
      const store = getMemoryStore()
      fs.mkdirSync(path.dirname(DEV_CACHE_FILE), { recursive: true })
      fs.writeFileSync(DEV_CACHE_FILE, JSON.stringify(Object.fromEntries(store.entries())))
    } catch {
      // ignore disk persist failures in dev
    }
  }, 250)
}

export function getKvClient(): Redis | null {
  if (client !== null) return client
  if (!hasRedisEnv()) return null

  client = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN!,
  })
  return client
}

export type KvStorageMode = 'redis' | 'memory' | 'none'

export function getKvStorageMode(): KvStorageMode {
  if (getKvClient()) return 'redis'
  if (useMemoryStore()) return 'memory'
  return 'none'
}

export function isKvConfigured(): boolean {
  return getKvStorageMode() !== 'none'
}

function readMemory<T>(key: string): T | null {
  loadDevCacheFromDisk()

  const entry = getMemoryStore().get(key)
  if (!entry) return null

  if (entry.expiresAt != null && entry.expiresAt <= Date.now()) {
    getMemoryStore().delete(key)
    scheduleDevCachePersist()
    return null
  }

  try {
    return JSON.parse(entry.payload) as T
  } catch {
    return null
  }
}

function writeMemory<T>(key: string, value: T, ttlSeconds?: number): void {
  const payload = JSON.stringify(value)
  const expiresAt = ttlSeconds != null ? Date.now() + Math.max(1, Math.floor(ttlSeconds)) * 1000 : undefined
  getMemoryStore().set(key, { payload, expiresAt })
  scheduleDevCachePersist()
}

export async function getJsonKv<T>(key: string): Promise<T | null> {
  if (useMemoryStore()) {
    return readMemory<T>(key)
  }

  const kv = getKvClient()
  if (!kv) return null

  try {
    const raw = await kv.get<unknown>(key)
    if (raw === null || raw === undefined) return null

    if (typeof raw === 'string') {
      return JSON.parse(raw) as T
    }

    return raw as T
  } catch {
    return null
  }
}

export async function setJsonKv<T>(key: string, value: T): Promise<boolean> {
  if (useMemoryStore()) {
    writeMemory(key, value)
    return true
  }

  const kv = getKvClient()
  if (!kv) return false

  try {
    await kv.set(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export async function setJsonKvEx<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  if (useMemoryStore()) {
    writeMemory(key, value, ttlSeconds)
    return
  }

  const kv = getKvClient()
  if (!kv) return

  const ex = Math.max(1, Math.floor(ttlSeconds))
  try {
    await kv.set(key, JSON.stringify(value), { ex })
  } catch {
    // ignore
  }
}
