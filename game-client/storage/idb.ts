const DB_NAME = 'chill-ranked'
const DB_VERSION = 1

export const IDB_STORES = {
  meta: 'meta',
  scoreHistory: 'score-history',
  runTraces: 'run-traces',
} as const

type StoreName = (typeof IDB_STORES)[keyof typeof IDB_STORES]

let dbPromise: Promise<IDBDatabase> | null = null

function isIdbAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

function openDatabase(): Promise<IDBDatabase> {
  if (!isIdbAvailable()) {
    return Promise.reject(new Error('IndexedDB is not available'))
  }
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(IDB_STORES.meta)) {
        db.createObjectStore(IDB_STORES.meta, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(IDB_STORES.scoreHistory)) {
        db.createObjectStore(IDB_STORES.scoreHistory, { keyPath: 'runId' })
      }
      if (!db.objectStoreNames.contains(IDB_STORES.runTraces)) {
        const store = db.createObjectStore(IDB_STORES.runTraces, { keyPath: 'runId' })
        store.createIndex('updatedAt', 'updatedAt')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
  })

  return dbPromise
}

function runTransaction<T>(storeName: StoreName, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode)
        const store = tx.objectStore(storeName)
        const request = run(store)
        request.onsuccess = () => resolve(request.result as T)
        request.onerror = () => reject(request.error ?? new Error(`IndexedDB ${storeName} request failed`))
        tx.onerror = () => reject(tx.error ?? new Error(`IndexedDB ${storeName} transaction failed`))
      })
  )
}

export async function idbGet<T>(storeName: StoreName, key: IDBValidKey): Promise<T | undefined> {
  if (!isIdbAvailable()) return undefined
  try {
    return await runTransaction(storeName, 'readonly', (store) => store.get(key))
  } catch {
    return undefined
  }
}

export async function idbPut<T>(storeName: StoreName, value: T): Promise<void> {
  if (!isIdbAvailable()) return
  await runTransaction(storeName, 'readwrite', (store) => store.put(value))
}

export async function idbDelete(storeName: StoreName, key: IDBValidKey): Promise<void> {
  if (!isIdbAvailable()) return
  await runTransaction(storeName, 'readwrite', (store) => store.delete(key))
}

export async function idbGetAll<T>(storeName: StoreName): Promise<T[]> {
  if (!isIdbAvailable()) return []
  try {
    return (await runTransaction(storeName, 'readonly', (store) => store.getAll())) as T[]
  } catch {
    return []
  }
}

export async function idbClear(storeName: StoreName): Promise<void> {
  if (!isIdbAvailable()) return
  await runTransaction(storeName, 'readwrite', (store) => store.clear())
}
