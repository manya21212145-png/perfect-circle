// UT-43 and UT-44 (browser storage and sync), using fake-indexeddb
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { allAttempts, clearAll, pendingQueue, saveAttempt, type Attempt } from '../../src/data/indexeddb';
import { syncPending } from '../../src/data/sync';

const attempt = (id: string, score = 90): Attempt => ({
  client_id: id, shape: 'circle', mode: 'classic', off_hand: false, score, created_at: Date.now(),
});

describe('data', () => {
  beforeEach(async () => { await clearAll(); });

  it('UT-43 saveAttempt stores the attempt and adds it to the sync queue', async () => {
    await saveAttempt(attempt('a1'));
    expect((await allAttempts()).map((a) => a.client_id)).toEqual(['a1']);
    expect((await pendingQueue()).map((a) => a.client_id)).toEqual(['a1']);
  });

  it('UT-44 syncPending clears the queue on success and keeps it on failure', async () => {
    await saveAttempt(attempt('b1'));
    await saveAttempt(attempt('b2'));

    const failing = vi.fn().mockRejectedValue(new Error('offline'));
    expect(await syncPending(failing)).toEqual({ sent: 0, error: 'offline' });
    expect(await pendingQueue()).toHaveLength(2);

    const ok = vi.fn().mockResolvedValue({ stored: 2 });
    expect(await syncPending(ok)).toEqual({ sent: 2 });
    expect(ok).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ client_id: 'b1' })]));
    expect(await pendingQueue()).toHaveLength(0);
    expect(await allAttempts()).toHaveLength(2); // history is kept
  });
});
