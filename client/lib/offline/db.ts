/**
 * Minimal IndexedDB wrapper for Qada's offline store.
 *
 * Scope (per the v2.0 offline strategy): this is NOT a general offline
 * framework. It stores exactly what a chef needs on the ground without
 * Internet:
 *   - members         (read-mostly cache, refreshed whenever online)
 *   - sessions         (read-mostly cache, filtered to the device's
 *                       trust window — see offline/sync.ts)
 *   - attendanceQueue  (write queue: attendance actions taken offline,
 *                       waiting to be pushed to Supabase)
 *   - meta             (small key/value store: last sync timestamps,
 *                       device trust info)
 *
 * No dependency on idb/dexie — a handful of stores with simple
 * key-paths doesn't need a query library, and keeping this
 * dependency-free keeps the offline layer auditable in one file.
 */

const DB_NAME = "qada-offline";
// v3: attendanceCache and membershipQueue were added to the
// onupgradeneeded handler below WITHOUT bumping this constant at the
// time. IndexedDB only runs onupgradeneeded when the requested version
// is higher than what's already on the device, so every device that
// had already opened the DB at version 2 (i.e. anyone who used the app
// before "Gestion de l'adhésion" was added) never got those two object
// stores created -- idbPut()/idbGetAll() on them throws
// "NotFoundError: object store not found", which silently breaks the
// membership save button (caught by MembershipManage.tsx's try/catch
// and shown as a generic save error) and the attendance cache reads.
// Bumping to 3 forces onupgradeneeded to run once more everywhere so
// the missing stores get created (idempotent: existing stores are
// left untouched by the `if (!contains(...))` guards below).
const DB_VERSION = 3;

export const STORES = {
  members: "members",
  sessions: "sessions",
  attendanceQueue: "attendanceQueue",
  attendanceCache: "attendanceCache",
  membershipQueue: "membershipQueue",
  meta: "meta",
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this environment"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORES.members)) {
        db.createObjectStore(STORES.members, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.sessions)) {
        db.createObjectStore(STORES.sessions, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.attendanceQueue)) {
        // keyPath is client_op_id: the client-generated idempotency
        // key. Using it as the primary key means re-queuing the same
        // action (e.g. a duplicate tap) overwrites in place instead
        // of creating a second queue entry.
        db.createObjectStore(STORES.attendanceQueue, {
          keyPath: "client_op_id",
        });
      }
      if (!db.objectStoreNames.contains(STORES.attendanceCache)) {
        // Local read cache of attendance already known (either synced
        // from the server, or queued locally) so the UI can show
        // "already marked present" without re-deriving it from the
        // queue every render. Keyed by `${session_id}:${member_id}`.
        db.createObjectStore(STORES.attendanceCache, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORES.membershipQueue)) {
        // Same idempotency pattern as attendanceQueue: keyed by the
        // client-generated client_op_id so re-queuing the same
        // toggle overwrites in place instead of duplicating.
        db.createObjectStore(STORES.membershipQueue, {
          keyPath: "client_op_id",
        });
      }
      if (!db.objectStoreNames.contains(STORES.meta)) {
        db.createObjectStore(STORES.meta, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

async function withStore<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = fn(store);

    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));

    if (request) {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } else {
      tx.oncomplete = () => resolve(undefined as T);
    }
  });
}

export async function idbGet<T>(
  storeName: StoreName,
  key: IDBValidKey,
): Promise<T | undefined> {
  return withStore<T>(storeName, "readonly", (store) => store.get(key));
}

export async function idbGetAll<T>(storeName: StoreName): Promise<T[]> {
  return withStore<T[]>(storeName, "readonly", (store) => store.getAll());
}

export async function idbPut<T>(storeName: StoreName, value: T): Promise<void> {
  await withStore(storeName, "readwrite", (store) => store.put(value));
}

export async function idbPutAll<T>(
  storeName: StoreName,
  values: T[],
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    for (const value of values) store.put(value as any);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
  });
}

export async function idbDelete(
  storeName: StoreName,
  key: IDBValidKey,
): Promise<void> {
  await withStore(storeName, "readwrite", (store) => store.delete(key));
}

/** Replace the entire contents of a store in one transaction. */
export async function idbReplaceAll<T>(
  storeName: StoreName,
  values: T[],
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.clear();
    for (const value of values) store.put(value as any);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
  });
}

export async function idbClear(storeName: StoreName): Promise<void> {
  await withStore(storeName, "readwrite", (store) => store.clear());
}
