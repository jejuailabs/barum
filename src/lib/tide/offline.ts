import type {Envelope, NormalizedTide} from '@/types/domain';

const DB_NAME = 'barum-offline-v1';
const STORE = 'tides';

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function cacheTide(key: string, value: Envelope<NormalizedTide>) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function readCachedTide(key: string) {
  const db = await openDatabase();
  const value = await new Promise<Envelope<NormalizedTide> | undefined>((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result as Envelope<NormalizedTide> | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return value;
}
