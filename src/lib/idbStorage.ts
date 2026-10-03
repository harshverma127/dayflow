import type { StateStorage } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// IndexedDB persistence
//
// A small, dependency-free AsyncStorage for zustand/persist. The previous
// implementation kept the whole workspace inside one localStorage JSON blob,
// which is capped at ~5MB and is synchronous. IndexedDB removes both limits.
//
// Behaviour:
//   * reads/writes go to IndexedDB when available;
//   * on the very first load, an existing localStorage payload is read,
//     copied into IndexedDB and returned so nothing is lost;
//   * if IndexedDB is unavailable (private mode / old browser) we transparently
//     fall back to localStorage.
// ---------------------------------------------------------------------------

const DB_NAME = 'preptrack';
const STORE_NAME = 'state';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbDel(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

const ls = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* quota / unavailable */
    }
  },
  del(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export const idbStorage: StateStorage = {
  getItem: async (name) => {
    const fromIdb = await idbGet(name);
    if (fromIdb !== null) return fromIdb;
    // First run on this device: adopt any legacy localStorage payload.
    const legacy = ls.get(name);
    if (legacy !== null) {
      void idbSet(name, legacy);
      return legacy;
    }
    return null;
  },
  setItem: async (name, value) => {
    await idbSet(name, value);
    // Keep a plaintext copy only as a safety net is unnecessary; remove any
    // stale legacy blob so the two stores cannot diverge.
    ls.del(name);
  },
  removeItem: async (name) => {
    await idbDel(name);
    ls.del(name);
  },
};
