// Online duels over Socket.IO: one room per 4-character code.
// DuelRoom holds the rules (rounds, countdown, scoring, disconnects) and knows nothing
// about sockets, so it can be unit tested. attachDuels() connects it to Socket.IO.

import type { Server, Socket } from 'socket.io';
import type { Db } from './db';
import { parseCookies, COOKIE } from './auth';
import { NICKNAME } from './routes/login';
import { scoreAttempt } from '../src/scoring';
import { SHAPES, type Shape } from '../src/scoring/templates';
import { MODES, timeLimitMs, type Mode } from '../src/modes';
import { TIME_LIMITS_S } from '../src/modes/timed';
import { newMatch, recordRound } from '../src/duel/match';
import {
  isRoomCode, makeRoomCode,
  type Countdown, type JoinReply, type MatchResult, type RoomState, type RoundResult, type Seat, type StrokeMessage,
} from '../src/duel/room';
import { randomBytes } from 'node:crypto';

export const COUNTDOWN_MS = 3000;        // 3-2-1
export const DISCONNECT_MS = 15_000;     // a player gone this long loses
export const ROOM_TTL_MS = 30 * 60_000;  // rooms expire after 30 minutes
export const NEXT_ROUND_MS = 4000;       // pause to read the round result
const GRACE_MS = 5000;                   // extra time for a stroke to arrive

type Send = (to: Seat | 'all', event: string, data: unknown) => void;

interface SeatInfo { nickname: string; playerId: number | null; token: string; connected: boolean }

interface RoundInfo {
  round: number; shape: Shape; mode: Mode; limitS?: number; startAt: number;
  strokes: Partial<Record<Seat, { score: number; reason?: string; finishMs: number }>>;
  timeout: ReturnType<typeof setTimeout>;
}

export interface RoomOptions {
  db?: Db;
  pick?: () => { shape: Shape; mode: Mode; limitS?: number };
}

const other = (s: Seat): Seat => (s === 'host' ? 'guest' : 'host');

function randomRound() {
  const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  const mode = MODES[Math.floor(Math.random() * MODES.length)];
  return mode === 'timed'
    ? { shape, mode, limitS: TIME_LIMITS_S[Math.floor(Math.random() * TIME_LIMITS_S.length)] }
    : { shape, mode };
}

export class DuelRoom {
  code: string;
  seats: Partial<Record<Seat, SeatInfo>> = {};
  status: RoomState['status'] = 'waiting';
  match = newMatch();
  ready = { host: false, guest: false };
  current: RoundInfo | null = null;
  lastActive = Date.now();
  private leaveTimers: Partial<Record<Seat, ReturnType<typeof setTimeout>>> = {};
  private nextTimer: ReturnType<typeof setTimeout> | null = null;
  private send: Send;
  private opts: RoomOptions;

  constructor(code: string, send: Send, opts: RoomOptions = {}) {
    this.code = code;
    this.send = send;
    this.opts = opts;
  }

  state(): RoomState {
    return {
      code: this.code,
      players: { host: this.seats.host?.nickname ?? null, guest: this.seats.guest?.nickname ?? null },
      connected: { host: !!this.seats.host?.connected, guest: !!this.seats.guest?.connected },
      status: this.status,
      wins: { host: this.match.wins[0], guest: this.match.wins[1] },
      round: this.current?.round ?? this.match.rounds.length,
    };
  }

  private broadcast() { this.send('all', 'room', this.state()); }

  /** A player joins (or comes back with their seat token after a reconnect). */
  onJoin(nickname: string, playerId: number | null, seatToken?: string): JoinReply {
    this.lastActive = Date.now();
    for (const seat of ['host', 'guest'] as Seat[]) {
      const s = this.seats[seat];
      if (s && seatToken && s.token === seatToken) {       // reconnect
        s.connected = true;
        clearTimeout(this.leaveTimers[seat]);
        delete this.leaveTimers[seat];
        this.broadcast();
        return { ok: true, code: this.code, seat, seatToken };
      }
    }
    const seat: Seat | null = !this.seats.host ? 'host' : !this.seats.guest ? 'guest' : null;
    if (!seat) return { ok: false, error: 'This room is full' };
    const token = randomBytes(12).toString('hex');
    this.seats[seat] = { nickname, playerId, token, connected: true };
    if (seat === 'host') this.opts.db?.saveRoom(this.code, playerId, 'waiting');
    else { this.status = 'ready'; this.opts.db?.setRoomStatus(this.code, 'ready', playerId); }
    this.broadcast();
    return { ok: true, code: this.code, seat, seatToken: token };
  }

  /** Both players tapped Ready → start (or restart, for a rematch). */
  onReady(seat: Seat) {
    this.lastActive = Date.now();
    if (!this.seats.host || !this.seats.guest || this.status === 'playing') return;
    this.ready[seat] = true;
    this.send('all', 'ready', { ...this.ready });
    if (this.ready.host && this.ready.guest) {
      this.ready = { host: false, guest: false };
      this.match = newMatch();
      this.status = 'playing';
      this.opts.db?.setRoomStatus(this.code, 'playing');
      this.startRound();
    }
  }

  /** Picks the shape and mode and sends everyone the same start time. */
  startRound() {
    const pick = (this.opts.pick ?? randomRound)();
    const now = Date.now();
    const round = this.match.rounds.length + 1;
    const startAt = now + COUNTDOWN_MS;
    const limit = timeLimitMs({ mode: pick.mode, limitS: pick.limitS as 5 | 3 | 2 | undefined });
    this.current = {
      round, ...pick, startAt, strokes: {},
      timeout: setTimeout(() => this.scoreRound(), startAt - now + limit + GRACE_MS),
    };
    const msg: Countdown = { round, shape: pick.shape, mode: pick.mode, limitS: pick.limitS, startAt, serverNow: now };
    this.send('all', 'countdown', msg);
    this.broadcast();
  }

  /** Live progress (0 to 1) is passed straight to the other player. */
  onProgress(seat: Seat, value: number) {
    if (this.status !== 'playing') return;
    this.send(other(seat), 'progress', { seat, value: Math.max(0, Math.min(1, Number(value) || 0)) });
  }

  /** A finished stroke arrives: the server scores it itself. */
  onStroke(seat: Seat, msg: StrokeMessage) {
    this.lastActive = Date.now();
    const cur = this.current;
    if (!cur || msg?.round !== cur.round || cur.strokes[seat]) return;
    const finishMs = Date.now() - cur.startAt;
    const stroke = Array.isArray(msg.stroke) ? msg.stroke.slice(0, 256) : [];
    let score = 0;
    let reason: string | undefined = msg.failed;
    if (!reason) {
      const r = stroke.length >= 10 ? scoreAttempt(stroke, cur) : ({ ok: false, reason: 'too_short' } as const);
      if (r.ok) score = r.score; else reason = r.reason;
    }
    cur.strokes[seat] = { score, reason, finishMs };
    if (cur.strokes.host && cur.strokes.guest) this.scoreRound();
  }

  /** Both strokes are in (or time ran out): decide the round and maybe the match. */
  scoreRound() {
    const cur = this.current;
    if (!cur) return;
    clearTimeout(cur.timeout);
    this.current = null;
    const missing = { score: 0, reason: 'no_stroke', finishMs: Infinity };
    const h = cur.strokes.host ?? missing;
    const g = cur.strokes.guest ?? missing;
    this.match = recordRound(this.match, h, g);
    const winner: Seat = this.match.rounds[this.match.rounds.length - 1] === 1 ? 'host' : 'guest';
    const wins = { host: this.match.wins[0], guest: this.match.wins[1] };
    const result: RoundResult = {
      round: cur.round, scores: { host: h.score, guest: g.score },
      reasons: { host: h.reason, guest: g.reason },
      finishMs: { host: Number.isFinite(h.finishMs) ? h.finishMs : -1, guest: Number.isFinite(g.finishMs) ? g.finishMs : -1 },
      winner, wins,
    };
    this.opts.db?.saveRound(this.code, cur.round, cur.shape, cur.mode, h.score, g.score,
      this.seats[winner]?.playerId ?? null, winner);
    this.send('all', 'round_result', result);

    if (this.match.winner) this.finish(this.match.winner === 1 ? 'host' : 'guest', 'wins');
    else this.nextTimer = setTimeout(() => this.startRound(), NEXT_ROUND_MS);
  }

  private finish(winner: Seat, reason: MatchResult['reason']) {
    if (this.current) { clearTimeout(this.current.timeout); this.current = null; }
    if (this.nextTimer) { clearTimeout(this.nextTimer); this.nextTimer = null; }
    this.status = 'finished';
    this.opts.db?.setRoomStatus(this.code, 'finished');
    const result: MatchResult = {
      winner, reason,
      wins: { host: this.match.wins[0], guest: this.match.wins[1] },
      players: this.state().players,
    };
    this.send('all', 'match_result', result);
    this.broadcast();
  }

  /** A player dropped. If they are not back within 15 s, the other player wins. */
  onDisconnect(seat: Seat) {
    const s = this.seats[seat];
    if (!s) return;
    s.connected = false;
    this.broadcast();
    if (this.status !== 'playing' && this.status !== 'ready') return;
    clearTimeout(this.leaveTimers[seat]);
    this.leaveTimers[seat] = setTimeout(() => {
      if (!s.connected && this.status !== 'finished' && this.seats[other(seat)]) this.finish(other(seat), 'disconnect');
    }, DISCONNECT_MS);
  }

  dispose() {
    if (this.current) clearTimeout(this.current.timeout);
    if (this.nextTimer) clearTimeout(this.nextTimer);
    for (const t of Object.values(this.leaveTimers)) clearTimeout(t);
  }
}

/** Connects DuelRoom to Socket.IO. Returns a function that stops the cleanup timer. */
export function attachDuels(io: Server, db?: Db) {
  const rooms = new Map<string, DuelRoom>();

  const who = (socket: Socket, fallback: unknown) => {
    const token = parseCookies(socket.handshake.headers.cookie)[COOKIE];
    const id = token && db ? db.sessionPlayer(token) : undefined;
    if (id !== undefined) return { nickname: db!.player(id)!.nickname, playerId: id };
    const nick = String(fallback ?? '').trim();
    return { nickname: NICKNAME.test(nick) ? nick : 'Guest-' + Math.floor(1000 + Math.random() * 9000), playerId: null };
  };

  const roomFor = (code: string) => {
    const room = new DuelRoom(code, (to, event, data) => {
      if (to === 'all') io.to(code).emit(event, data);
      else io.to(`${code}:${to}`).emit(event, data);
    }, { db });
    rooms.set(code, room);
    return room;
  };

  const seatSocket = (socket: Socket, room: DuelRoom, reply: JoinReply) => {
    if (!reply.ok || !reply.seat) return;
    socket.data.code = room.code;
    socket.data.seat = reply.seat;
    socket.join(room.code);
    socket.join(`${room.code}:${reply.seat}`);
    socket.emit('room', room.state());
  };

  io.on('connection', (socket) => {
    socket.on('create', (payload: { nickname?: string }, ack?: (r: JoinReply) => void) => {
      let code = makeRoomCode();
      while (rooms.has(code)) code = makeRoomCode();
      const room = roomFor(code);
      const { nickname, playerId } = who(socket, payload?.nickname);
      const reply = room.onJoin(nickname, playerId);
      ack?.(reply);
      seatSocket(socket, room, reply);
    });

    socket.on('join', (payload: { code?: string; nickname?: string; seatToken?: string }, ack?: (r: JoinReply) => void) => {
      const code = String(payload?.code ?? '').toUpperCase();
      const room = isRoomCode(code) ? rooms.get(code) : undefined;
      if (!room) return void ack?.({ ok: false, error: 'No room with that code' });
      const { nickname, playerId } = who(socket, payload?.nickname);
      const reply = room.onJoin(nickname, playerId, payload?.seatToken);
      ack?.(reply);
      seatSocket(socket, room, reply);
    });

    const inRoom = () => {
      const room = rooms.get(socket.data.code);
      return room && socket.data.seat ? { room, seat: socket.data.seat as Seat } : null;
    };
    socket.on('ready', () => { const r = inRoom(); r?.room.onReady(r.seat); });
    socket.on('progress', (value: number) => { const r = inRoom(); r?.room.onProgress(r.seat, value); });
    socket.on('stroke', (msg: StrokeMessage) => { const r = inRoom(); r?.room.onStroke(r.seat, msg); });
    socket.on('disconnect', () => { const r = inRoom(); r?.room.onDisconnect(r.seat); });
  });

  const sweep = setInterval(() => {
    for (const [code, room] of rooms) {
      if (Date.now() - room.lastActive > ROOM_TTL_MS) {
        room.dispose();
        rooms.delete(code);
        db?.setRoomStatus(code, 'expired');
      }
    }
  }, 60_000);
  sweep.unref();

  return { rooms, stop: () => { clearInterval(sweep); for (const r of rooms.values()) r.dispose(); } };
}
