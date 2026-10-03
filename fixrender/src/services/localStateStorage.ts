/**
 * Persistencia local del estado de la aplicación.
 * IndexedDB evita que un POS offline dependa de localStorage para un objeto enorme.
 * Las escrituras se agrupan brevemente para evitar serializar el store en cada set().
 */
import type { StateStorage } from 'zustand/middleware';

const DB_NAME = 'omnisync-pos-local-state';
const DB_VERSION = 1;
const STORE = 'state';
const KEY = 'zustand';
let writeTimer: ReturnType<typeof setTimeout> | null = null;
let pendingValue: string | null = null;
let writeChain: Promise<void> = Promise.resolve();

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise(resolve => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function read(): Promise<string | null> {
  const db = await openDb();
  if (!db) return localStorage.getItem('pos-store-storage');
  return new Promise(resolve => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null);
    req.onerror = () => resolve(null);
    tx.oncomplete = () => db.close();
  });
}

async function writeNow(value: string): Promise<void> {
  writeChain = writeChain.then(async () => {
    const db = await openDb();
    if (!db) {
      try { localStorage.setItem('pos-store-storage', value); } catch {}
      return;
    }
    await new Promise<void>(resolve => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  });
  await writeChain;
}

export const localStateStorage: StateStorage = {
  getItem: async () => {
    const value = await read();
    // Migración transparente desde la persistencia antigua de Zustand.
    if (value && typeof indexedDB !== 'undefined' && localStorage.getItem('pos-store-storage')) {
      void writeNow(value).then(() => {
        try { localStorage.removeItem('pos-store-storage'); } catch {}
      });
    }
    return value;
  },
  setItem: async (_name, value) => {
    pendingValue = value;
    if (writeTimer) return;
    writeTimer = setTimeout(() => {
      writeTimer = null;
      const next = pendingValue;
      pendingValue = null;
      if (next != null) void writeNow(next);
    }, 250);
  },
  removeItem: async () => {
    const db = await openDb();
    if (!db) {
      try { localStorage.removeItem('pos-store-storage'); } catch {}
      return;
    }
    await new Promise<void>(resolve => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  }
};

export async function clearLocalStateStorage(): Promise<void> {
  if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; pendingValue = null; }
  const db = await openDb();
  if (!db) { try { localStorage.removeItem('pos-store-storage'); } catch {} return; }
  await new Promise<void>(resolve => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  db.close();
}
