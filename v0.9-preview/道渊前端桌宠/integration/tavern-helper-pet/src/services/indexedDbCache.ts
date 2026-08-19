export interface CacheRecord<T> {
  key: string;
  value: T;
  storedAt: number;
}

export interface CacheStore<T> {
  get(key: string): Promise<T | undefined>;
  set(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

const DB_NAME = 'daoyuan-feature-frontend-cache';
const STORE_NAME = 'rebuildable';
const memory = new Map<string, CacheRecord<unknown>>();

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
}

export function createCacheStore<T>(): CacheStore<T> {
  return {
    async get(key) {
      if (!hasIndexedDb()) return memory.get(key)?.value as T | undefined;
      try {
        const db = await openDb();
        return await new Promise<T | undefined>((resolve, reject) => {
          const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
          request.onsuccess = () => resolve((request.result as CacheRecord<T> | undefined)?.value);
          request.onerror = () => reject(request.error);
        });
      } catch {
        return memory.get(key)?.value as T | undefined;
      }
    },
    async set(key, value) {
      const record = { key, value, storedAt: Date.now() } satisfies CacheRecord<T>;
      memory.set(key, record);
      if (!hasIndexedDb()) return;
      try {
        const db = await openDb();
        await new Promise<void>((resolve, reject) => {
          const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(record);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      } catch {
        // Cache failure must never block chat-variable writes or the UI.
      }
    },
    async delete(key) {
      memory.delete(key);
      if (!hasIndexedDb()) return;
      try {
        const db = await openDb();
        db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(key);
      } catch {
        // Best-effort cleanup only.
      }
    },
    async clear() {
      memory.clear();
      if (!hasIndexedDb()) return;
      try {
        const db = await openDb();
        db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).clear();
      } catch {
        // Best-effort cleanup only.
      }
    },
  };
}
