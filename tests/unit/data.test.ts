// UT-43 and UT-44 (browser storage and sync), using fake-indexeddb
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { allAttempts, clearAll, exportAll, kvGet, kvSet, pendingQueue, saveAttempt, type Attempt } from '../../src/data/indexeddb';
import { pullAttempts, syncPending } from '../../src/data/sync';

const attempt = (id: string, score = 90): Attempt => ({
  client_id: id, shape: 'circle', mode: 'classic', off_hand: false, score, created_at: Date.now(),
});

describe('data', () => {
  beforeEach(async () => { await clearAll(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('UT-43 saveAttempt stores the attempt and adds it to the sync queue', async () => {
    await saveAttempt(attempt('a1'));
    expect((await allAttempts()).map((a) => a.client_id)).toEqual(['a1']);
    expect((await pendingQueue()).map((a) => a.client_id)).toEqual(['a1']);
    await kvSet('badges', { first_circle: 1 });
    expect(await kvGet('badges')).toEqual({ first_circle: 1 });
    const backup = await exportAll();   // Settings → Export
    expect(backup.attempts).toHaveLength(1);
    expect(backup.kv.badges).toEqual({ first_circle: 1 });
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

    // The same through the real API code, with a fake network: HTTP failure, then success
    await saveAttempt(attempt('c1'));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Please log in' }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ stored: 1 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ attempts: [attempt('from-laptop', 77)] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await syncPending()).toEqual({ sent: 0, error: 'Please log in' });
    expect(await pendingQueue()).toHaveLength(1);
    expect(await syncPending()).toEqual({ sent: 1 });
    expect(fetchMock.mock.calls[1][0]).toBe('/api/attempts');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).attempts[0].client_id).toBe('c1');
    expect(await pendingQueue()).toHaveLength(0);

    expect(await pullAttempts()).toBe(1);          // attempts from another device are merged
    expect((await allAttempts()).map((a) => a.client_id).sort()).toEqual(['b1', 'b2', 'c1', 'from-laptop']);
  });
});
