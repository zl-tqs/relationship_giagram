import type { Edge, Node } from '@xyflow/react';
import { canvasFingerprint } from '../canvas/fingerprint';

export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type Draft = {
  userId: string;
  projectId: string;
  nodes: Node[];
  edges: Edge[];
  viewport: { x: number; y: number; zoom: number };
  baseRevision: number;
  updatedAt: number;
  schemaVersion: number;
};

type StoredDraft = Draft & { key: string };

const DB_NAME = 'relationship-diagram';
const STORE_NAME = 'drafts';
const memory = new Map<string, Draft>();
let dbPromise: Promise<IDBDatabase> | null = null;

const keyOf = (userId: string, projectId: string) => `${userId}:${projectId}`;

function hasIndexedDb() {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

function stripKey(stored: StoredDraft): Draft {
  const { key: _key, ...draft } = stored;
  return draft;
}

async function requestStore<T>(
  mode: IDBTransactionMode,
  operate: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let result: T | undefined;
    const request = operate(store);
    if (request) request.onsuccess = () => { result = request.result; };
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function putDraft(draft: Draft) {
  const key = keyOf(draft.userId, draft.projectId);
  if (!hasIndexedDb()) {
    memory.set(key, draft);
    return;
  }
  try {
    await requestStore('readwrite', (store) => store.put({ ...draft, key } as StoredDraft));
  } catch {
    memory.set(key, draft);
  }
}

export async function getDraft(userId: string, projectId: string): Promise<Draft | null> {
  const key = keyOf(userId, projectId);
  let found: Draft | null = null;

  if (!hasIndexedDb()) {
    found = memory.get(key) ?? null;
  } else {
    try {
      const stored = await requestStore<StoredDraft>('readonly', (store) => store.get(key));
      found = stored ? stripKey(stored) : null;
    } catch {
      found = memory.get(key) ?? null;
    }
  }

  if (found && Date.now() - found.updatedAt > DRAFT_TTL_MS) {
    await deleteDraft(userId, projectId);
    return null;
  }
  return found;
}

export async function deleteDraft(userId: string, projectId: string) {
  const key = keyOf(userId, projectId);
  memory.delete(key);
  if (!hasIndexedDb()) return;
  try {
    await requestStore('readwrite', (store) => store.delete(key));
  } catch {
    // ignore
  }
}

export async function clearUserDrafts(userId: string) {
  for (const [key, value] of memory) {
    if (value.userId === userId) memory.delete(key);
  }
  if (!hasIndexedDb()) return;

  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        if ((cursor.value as StoredDraft).userId === userId) cursor.delete();
        cursor.continue();
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    // ignore
  }
}

export function clearDraftsForTest() {
  memory.clear();
}

export type DraftDecision = 'discard' | 'apply' | 'stale';

export function decideDraft(
  draft: Draft,
  serverRevision: number,
  serverFingerprint: string,
): DraftDecision {
  if (canvasFingerprint(draft.nodes, draft.edges) === serverFingerprint) return 'discard';
  if (draft.baseRevision === serverRevision) return 'apply';
  return 'stale';
}
