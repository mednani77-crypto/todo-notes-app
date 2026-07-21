const DATABASE_NAME = 'todo-notes-app-media';
const DATABASE_VERSION = 1;
const STORE_NAME = 'media';

function openDatabase() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('indexeddb-unavailable'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('indexeddb-open-failed'));
  });
}

async function runTransaction(mode, action) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = action(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('indexeddb-request-failed'));
      transaction.onerror = () => reject(transaction.error || new Error('indexeddb-transaction-failed'));
    });
  } finally {
    database.close();
  }
}

export function putMedia(record) {
  return runTransaction('readwrite', (store) => store.put(record));
}

export function getMedia(id) {
  return runTransaction('readonly', (store) => store.get(id));
}

export function deleteMedia(id) {
  return runTransaction('readwrite', (store) => store.delete(id));
}

export function listMedia() {
  return runTransaction('readonly', (store) => store.getAll());
}

export async function mediaUsage() {
  const records = await listMedia();
  return records.reduce((total, record) => total + Number(record.blob?.size || 0), 0);
}
