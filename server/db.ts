// SQLite setup and queries. The whole database is one file: data/perfect-circle.db
// (or data/test.db for business testing, or ':memory:' in unit tests).

import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export interface PlayerRow { id: number; nickname: string; pin_hash: string; created_at: number }
export interface AttemptRow {
  client_id: string; shape: string; mode: string; limit_s: number | null; off_hand: number;
  score: number; daily_date: string | null; created_at: number;
}

export function openDb(file = join(here, '..', 'data', 'perfect-circle.db')) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const sql = new Database(file);
  sql.pragma('journal_mode = WAL');   // safer if the PC loses power
  sql.pragma('foreign_keys = ON');
  sql.exec(readFileSync(join(here, 'schema.sql'), 'utf8'));

  const q = {
    playerByNick: sql.prepare<[string], PlayerRow>('SELECT * FROM players WHERE nickname = ?'),
    playerById: sql.prepare<[number], PlayerRow>('SELECT * FROM players WHERE id = ?'),
    addPlayer: sql.prepare('INSERT INTO players (nickname, pin_hash, created_at) VALUES (?, ?, ?)'),
    rename: sql.prepare('UPDATE players SET nickname = ? WHERE id = ?'),
    addSession: sql.prepare('INSERT INTO sessions (token, player_id, expires_at) VALUES (?, ?, ?)'),
    session: sql.prepare<[string, number], { player_id: number }>('SELECT player_id FROM sessions WHERE token = ? AND expires_at > ?'),
    dropSession: sql.prepare('DELETE FROM sessions WHERE token = ?'),
    addAttempt: sql.prepare(`INSERT OR IGNORE INTO attempts
      (client_id, player_id, shape, mode, limit_s, off_hand, score, daily_date, created_at)
      VALUES (@client_id, @player_id, @shape, @mode, @limit_s, @off_hand, @score, @daily_date, @created_at)`),
    attempts: sql.prepare<[number], AttemptRow>(`SELECT client_id, shape, mode, limit_s, off_hand, score, daily_date, created_at
      FROM attempts WHERE player_id = ? ORDER BY created_at`),
    addDaily: sql.prepare(`INSERT OR IGNORE INTO daily_results (player_id, challenge_date, score, stroke, created_at)
      VALUES (?, ?, ?, ?, ?)`),
    daily: sql.prepare<[number, string], { score: number }>('SELECT score FROM daily_results WHERE player_id = ? AND challenge_date = ?'),
    top: sql.prepare<[string], { nickname: string; score: number }>(`SELECT p.nickname, d.score FROM daily_results d
      JOIN players p ON p.id = d.player_id WHERE d.challenge_date = ? ORDER BY d.score DESC, d.created_at ASC LIMIT 100`),
    addBadge: sql.prepare('INSERT OR IGNORE INTO badges_earned (player_id, badge_id, earned_at) VALUES (?, ?, ?)'),
    badges: sql.prepare<[number], { badge_id: string; earned_at: number }>('SELECT badge_id, earned_at FROM badges_earned WHERE player_id = ?'),
    addRoom: sql.prepare('INSERT OR REPLACE INTO duel_rooms (code, host_id, guest_id, status, created_at) VALUES (?, ?, ?, ?, ?)'),
    roomStatus: sql.prepare('UPDATE duel_rooms SET status = ?, guest_id = COALESCE(?, guest_id) WHERE code = ?'),
    addRound: sql.prepare(`INSERT OR REPLACE INTO duel_rounds
      (room_code, round, shape, mode, host_score, guest_score, winner_id, winner_seat) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`),
  };

  return {
    sql,
    findPlayer: (nickname: string) => q.playerByNick.get(nickname),
    player: (id: number) => q.playerById.get(id),
    createPlayer: (nickname: string, pinHash: string) => Number(q.addPlayer.run(nickname, pinHash, Date.now()).lastInsertRowid),
    renamePlayer: (id: number, nickname: string) => q.rename.run(nickname, id),
    createSession: (token: string, playerId: number, expiresAt: number) => q.addSession.run(token, playerId, expiresAt),
    sessionPlayer: (token: string) => q.session.get(token, Date.now())?.player_id,
    deleteSession: (token: string) => q.dropSession.run(token),
    /** Returns how many were new (duplicates by client_id are skipped). */
    insertAttempts: (playerId: number, rows: Omit<AttemptRow, never>[]) =>
      sql.transaction(() => rows.reduce((n, r) => n + q.addAttempt.run({ ...r, player_id: playerId }).changes, 0))(),
    attempts: (playerId: number) => q.attempts.all(playerId),
    insertDaily: (playerId: number, date: string, score: number, stroke: string) =>
      q.addDaily.run(playerId, date, score, stroke, Date.now()).changes === 1,
    dailyScore: (playerId: number, date: string) => q.daily.get(playerId, date)?.score,
    topScores: (date: string) => q.top.all(date),
    insertBadges: (playerId: number, rows: { badge_id: string; earned_at: number }[]) =>
      sql.transaction(() => rows.forEach((b) => q.addBadge.run(playerId, b.badge_id, b.earned_at)))(),
    badges: (playerId: number) => q.badges.all(playerId),
    saveRoom: (code: string, hostId: number | null, status: string) => q.addRoom.run(code, hostId, null, status, Date.now()),
    setRoomStatus: (code: string, status: string, guestId: number | null = null) => q.roomStatus.run(status, guestId, code),
    saveRound: (code: string, round: number, shape: string, mode: string, hostScore: number, guestScore: number,
      winnerId: number | null, winnerSeat: string) =>
      q.addRound.run(code, round, shape, mode, hostScore, guestScore, winnerId, winnerSeat),
    close: () => sql.close(),
  };
}

export type Db = ReturnType<typeof openDb>;
