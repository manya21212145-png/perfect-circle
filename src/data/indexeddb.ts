// Browser storage (IndexedDB, through the small "idb" library).
// Every attempt is saved here first, then queued for upload to the PC server.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Shape } from '../scoring/templates';
import type { Mode } from '../modes';

export interface Attempt {
  client_id: string;       // made on this device; the server uses it to ignore duplicates
  shape: Shape;
  mode: Mode;
  limit_s?: number | null;
  off_hand: boolean;
  score: number;           // one decimal
  daily_date?: string | null; // set on the one scored daily attempt of that day
  created_at: number;      // ms since 1970
}

interface Schema extends DBSchema {
  attempts: { key: string; value: Attempt; indexes: { created_at: number } };
  queue: { key: string; value: Attempt };           // waiting to be uploaded
  kv: { key: string; value: unknown };              // small values: badges, daily results, ...
}

const DB_NAME = 'perfect-circle';
let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

export function db(): Promise<IDBPDatabase<Schema>> {
  dbPromise ??= openDB<Schema>(DB_NAME, 1, {
    upgrade(d) {
      const attempts = d.createObjectStore('attempts', { keyPath: 'client_id' });
      attempts.createIndex('created_at', 'created_at');
      d.createObjectStore('queue', { keyPath: 'client_id' });
      d.createObjectStore('kv');
    },
  });
  return dbPromise;
}

/** Saves an attempt and adds it to the upload queue (one transaction, so both or neither). */
export async function saveAttempt(a: Attempt): Promise<void> {
  const tx = (await db()).transaction(['attempts', 'queue'], 'readwrite');
  await Promise.all([tx.objectStore('attempts').put(a), tx.objectStore('queue').put(a), tx.done]);
}

export async function allAttempts(): Promise<Attempt[]> {
  return (await db()).getAllFromIndex('attempts', 'created_at');
}

export async function pendingQueue(): Promise<Attempt[]> {
  return (await db()).getAll('queue');
}

export async function removeFromQueue(ids: string[]): Promise<void> {
  const tx = (await db()).transaction('queue', 'readwrite');
  await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
}

/** Adds attempts downloaded from the server (from another device). Not queued again. */
export async function mergeAttempts(list: Attempt[]): Promise<void> {
  const tx = (await db()).transaction('attempts', 'readwrite');
  await Promise.all([...list.map((a) => tx.store.put(a)), tx.done]);
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return (await db()).get('kv', key) as Promise<T | undefined>;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await (await db()).put('kv', value, key);
}

/** Everything on this device, for Settings → Export. */
export async function exportAll() {
  const d = await db();
  const keys = await d.getAllKeys('kv');
  const kv: Record<string, unknown> = {};
  for (const k of keys) kv[String(k)] = await d.get('kv', k);
  return { exported_at: new Date().toISOString(), attempts: await d.getAll('attempts'), queue: await d.getAll('queue'), kv };
}

/** Settings → Reset: deletes everything saved on this device. */
export async function clearAll(): Promise<void> {
  const d = await db();
  const tx = d.transaction(['attempts', 'queue', 'kv'], 'readwrite');
  await Promise.all([tx.objectStore('attempts').clear(), tx.objectStore('queue').clear(), tx.objectStore('kv').clear(), tx.done]);
}

/** A random id. crypto.randomUUID only works on https, so build one from random bytes. */
export function newId(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}
