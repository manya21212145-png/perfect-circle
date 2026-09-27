// UT-45 to UT-48 (local server), with Supertest and an in-memory SQLite database
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { io as connect, type Socket } from 'socket.io-client';
import { openDb } from '../../server/db';
import { createApp } from '../../server/app';
import { attachDuels } from '../../server/duel';
import { dailyChallenge, utcDate } from '../../src/daily/seed';
import { scoreAttempt } from '../../src/scoring';
import { makeCircle, makePolygon } from '../helpers/strokes';
import type { Countdown, JoinReply } from '../../src/duel/room';
import type { Stroke } from '../../src/scoring/types';

const db = openDb(':memory:');
const app = createApp({ db, distDir: '/nonexistent' });

async function login(nickname: string, pin = '1234') {
  const agent = request.agent(app);
  const res = await agent.post('/api/login').send({ nickname, pin });
  return { agent, res };
}

/** An ideal stroke for today's challenge, 128 points around (0, 0). */
function strokeFor(date: string): Stroke {
  const c = dailyChallenge(date);
  const base = c.shape === 'circle'
    ? makeCircle({ cx: 0, cy: 0, r: 150, points: 128, noise: 0.03, seed: 3, durationMs: 1500 })
    : makePolygon({ shape: c.shape, cx: 0, cy: 0, size: 160, durationMs: 1500 });
  return base;
}

describe('server', () => {
  it('UT-45 POST /api/daily: server score matches within 0.01; a changed client score is ignored', async () => {
    const { agent } = await login('dailyplayer');
    const date = utcDate(new Date());
    const stroke = strokeFor(date);
    const expected = scoreAttempt(stroke, dailyChallenge(date));

    const res = await agent.post('/api/daily').send({ date, stroke, score: 100 }); // client claims 100
    expect(res.status).toBe(200);
    if (expected.ok) {
      expect(Math.abs(res.body.score - expected.score)).toBeLessThanOrEqual(0.01);
      expect(res.body.stored).toBe(true);
    } else {
      expect(res.body.score).toBeNull();
    }
    const board = await agent.get(`/api/daily/${date}/leaderboard`);
    if (expected.ok) expect(board.body.rows).toEqual([{ nickname: 'dailyplayer', score: expected.score }]);

    // A second try the same day is not stored and does not change the score
    const again = await agent.post('/api/daily').send({ date, stroke: makeCircle({ cx: 0, cy: 0, r: 150, points: 128 }), score: 100 });
    expect(again.body.stored).toBe(false);
  });

  it('UT-46 POST /api/login creates a player with a hashed PIN; a wrong PIN gets 401', async () => {
    const first = await login('newplayer', '4321');
    expect(first.res.status).toBe(200);
    expect(first.res.body.nickname).toBe('newplayer');
    expect(first.res.headers['set-cookie'][0]).toMatch(/pc_session=.*HttpOnly/i);
    const row = db.findPlayer('newplayer')!;
    expect(row.pin_hash).not.toBe('4321');
    expect(row.pin_hash).toMatch(/^\$2[aby]\$/); // bcrypt hash

    const wrong = await request(app).post('/api/login').send({ nickname: 'newplayer', pin: '0000' });
    expect(wrong.status).toBe(401);
  });

  it('UT-48 POST /api/attempts twice with the same client_ids stores each attempt once', async () => {
    const { agent } = await login('syncplayer');
    const attempts = ['x1', 'x2', 'x3'].map((id, i) => ({
      client_id: id, shape: 'circle', mode: 'classic', off_hand: false, score: 80 + i, created_at: 1_790_000_000_000 + i,
    }));
    expect((await agent.post('/api/attempts').send({ attempts })).body.stored).toBe(3);
    expect((await agent.post('/api/attempts').send({ attempts })).body.stored).toBe(0);
    const list = await agent.get('/api/attempts');
    expect(list.body.attempts).toHaveLength(3);
  });

  describe('duel rooms over Socket.IO', () => {
    let http: HttpServer;
    let url: string;
    let stop: () => void;
    const clients: Socket[] = [];

    beforeAll(async () => {
      http = createServer(app);
      const io = new Server(http);
      stop = attachDuels(io, db).stop;
      await new Promise<void>((resolve) => http.listen(0, resolve));
      url = `http://localhost:${(http.address() as AddressInfo).port}`;
    });
    afterAll(() => {
      clients.forEach((c) => c.close());
      stop();
      http.close();
    });

    it('UT-47 two Socket.IO test clients in the same room get the same countdown start time', async () => {
      const a = connect(url, { transports: ['websocket'] });
      const b = connect(url, { transports: ['websocket'] });
      clients.push(a, b);

      const created = await new Promise<JoinReply>((resolve) => a.emit('create', { nickname: 'Asha' }, resolve));
      expect(created.ok).toBe(true);
      const joined = await new Promise<JoinReply>((resolve) => b.emit('join', { code: created.code, nickname: 'Ravi' }, resolve));
      expect(joined.seat).toBe('guest');

      const countdownA = new Promise<Countdown>((resolve) => a.once('countdown', resolve));
      const countdownB = new Promise<Countdown>((resolve) => b.once('countdown', resolve));
      a.emit('ready');
      b.emit('ready');
      const [ca, cb] = await Promise.all([countdownA, countdownB]);
      expect(ca.startAt).toBe(cb.startAt);
      expect(ca.shape).toBe(cb.shape);
      expect(ca.startAt - ca.serverNow).toBe(3000);
    });
  });
});
