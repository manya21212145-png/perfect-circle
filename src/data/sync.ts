// Uploads queued attempts to the PC server when it can be reached and the player is logged in.

import { api } from './api';
import { mergeAttempts, pendingQueue, removeFromQueue, type Attempt } from './indexeddb';

export interface SyncResult { sent: number; error?: string }

/**
 * Sends everything in the queue. On success the queue is emptied; on failure
 * (offline, server off, not logged in) it is kept for next time.
 */
export async function syncPending(
  post: (attempts: Attempt[]) => Promise<unknown> = api.postAttempts,
): Promise<SyncResult> {
  const queue = await pendingQueue();
  if (queue.length === 0) return { sent: 0 };
  try {
    await post(queue);
    await removeFromQueue(queue.map((a) => a.client_id));
    return { sent: queue.length };
  } catch (e) {
    return { sent: 0, error: (e as Error).message };
  }
}

/** Downloads this player's attempts from other devices and stores them here. */
export async function pullAttempts(get = api.getAttempts): Promise<number> {
  const { attempts } = await get();
  await mergeAttempts(attempts);
  return attempts.length;
}
