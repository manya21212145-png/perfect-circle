// UT-39 to UT-42 (duel logic)
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeRoomCode, ROOM_CODE_LENGTH } from '../../src/duel/room';
import { assignTouch, createTouchAssigner } from '../../src/duel/split-screen';
import { newMatch, recordRound } from '../../src/duel/match';
import { DuelRoom, DISCONNECT_MS } from '../../server/duel';

describe('duel', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('UT-39 1,000 room codes are 4 characters with no O, 0, I or 1', () => {
    for (let i = 0; i < 1000; i++) {
      const code = makeRoomCode();
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      expect(code).not.toMatch(/[O0I1]/);
    }
  });

  it('UT-40 assignTouch at x = 100 and x = 900 on a 1000 px screen gives players 1 and 2; a touch keeps its side', () => {
    expect(assignTouch(100, 1000)).toBe(1);
    expect(assignTouch(900, 1000)).toBe(2);
    const touches = createTouchAssigner();
    touches.start(7, 450, 1000);          // starts on the left...
    expect(touches.owner(7)).toBe(1);     // ...and slides across the middle to x = 600
    expect(touches.owner(7)).toBe(1);
    touches.end(7);
    expect(touches.owner(7)).toBeUndefined();
  });

  it('UT-41 match ends after 2 wins; a tied round goes to the faster finish', () => {
    let m = newMatch();
    m = recordRound(m, { score: 90, finishMs: 3000 }, { score: 80, finishMs: 2000 });
    expect(m.winner).toBeNull();
    m = recordRound(m, { score: 88, finishMs: 3000 }, { score: 70, finishMs: 2000 });
    expect(m.winner).toBe(1);
    expect(m.wins).toEqual([2, 0]);
    expect(recordRound(m, { score: 1, finishMs: 1 }, { score: 99, finishMs: 1 })).toBe(m); // no more rounds

    const tie = recordRound(newMatch(), { score: 85, finishMs: 3100 }, { score: 85, finishMs: 2900 });
    expect(tie.rounds).toEqual([2]);
  });

  it('UT-42 when the opponent is disconnected for 15.1 s, the remaining player wins', () => {
    vi.useFakeTimers();
    const sent: { to: string; event: string; data: unknown }[] = [];
    const room = new DuelRoom('ABCD', (to, event, data) => sent.push({ to, event, data }),
      { pick: () => ({ shape: 'circle', mode: 'classic' }) });
    room.onJoin('Asha', null);
    room.onJoin('Ravi', null);
    room.onReady('host');
    room.onReady('guest');
    room.onDisconnect('guest');

    vi.advanceTimersByTime(DISCONNECT_MS - 1);
    expect(sent.find((s) => s.event === 'match_result')).toBeUndefined();
    vi.advanceTimersByTime(101); // 15.1 s in total
    const result = sent.find((s) => s.event === 'match_result');
    expect(result?.data).toMatchObject({ winner: 'host', reason: 'disconnect' });
    room.dispose();
  });
});
