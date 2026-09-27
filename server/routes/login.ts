// POST /api/login  – nickname + 4-digit PIN. Creates the player on first use.
// POST /api/logout – ends the session.
// GET  /api/me     – who is logged in, plus their badges.
// PATCH /api/me    – change nickname.

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import type { Db } from '../db';
import { COOKIE, SESSION_DAYS, requireLogin, sessionToken } from '../auth';

export const NICKNAME = /^[A-Za-z0-9_-]{3,16}$/; // 3–16 letters, numbers, _ or -
export const PIN = /^\d{4}$/;                     // FR-23: a 4-digit PIN

export function loginRoutes(db: Db, secureCookie: boolean) {
  const r = Router();

  r.post('/login', async (req, res) => {
    const nickname = String(req.body?.nickname ?? '').trim();
    const pin = String(req.body?.pin ?? '');
    if (!NICKNAME.test(nickname)) return void res.status(400).json({ error: 'Nickname: 3–16 letters, numbers, _ or -' });
    if (!PIN.test(pin)) return void res.status(400).json({ error: 'PIN must be 4 digits' });

    let player = db.findPlayer(nickname);
    if (!player) {
      const id = db.createPlayer(nickname, await bcrypt.hash(pin, 10)); // first login creates the player
      player = db.player(id)!;
    } else if (!(await bcrypt.compare(pin, player.pin_hash))) {
      return void res.status(401).json({ error: 'Wrong PIN for this nickname' });
    }

    const token = randomBytes(32).toString('hex');
    const maxAge = SESSION_DAYS * 86_400_000;
    db.createSession(token, player.id, Date.now() + maxAge);
    res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: secureCookie, maxAge });
    res.json({ nickname: player.nickname, badges: db.badges(player.id) });
  });

  r.post('/logout', (req, res) => {
    const token = sessionToken(req);
    if (token) db.deleteSession(token);
    res.clearCookie(COOKIE);
    res.json({ ok: true });
  });

  r.get('/me', requireLogin(db), (_req, res) => {
    const id = res.locals.playerId as number;
    res.json({ nickname: db.player(id)!.nickname, badges: db.badges(id) });
  });

  r.patch('/me', requireLogin(db), (req, res) => {
    const id = res.locals.playerId as number;
    const nickname = String(req.body?.nickname ?? '').trim();
    if (!NICKNAME.test(nickname)) return void res.status(400).json({ error: 'Nickname: 3–16 letters, numbers, _ or -' });
    const taken = db.findPlayer(nickname);
    if (taken && taken.id !== id) return void res.status(409).json({ error: 'That nickname is taken' });
    db.renamePlayer(id, nickname);
    res.json({ nickname, badges: db.badges(id) });
  });

  return r;
}
