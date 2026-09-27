// POST /api/attempts – uploads queued attempts; a repeated client_id is ignored.
// GET  /api/attempts – the player's history, for another device.
// POST /api/badges   – badges earned on a device, so every device shows them.

import { Router } from 'express';
import type { Db } from '../db';
import { requireLogin } from '../auth';
import { SHAPES } from '../../src/scoring/templates';
import { MODES } from '../../src/modes';
import { BADGES } from '../../src/progression/badges';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function attemptRoutes(db: Db) {
  const r = Router();
  r.use(requireLogin(db));

  r.post('/attempts', (req, res) => {
    const list = Array.isArray(req.body?.attempts) ? req.body.attempts : null;
    if (!list || list.length > 500) return void res.status(400).json({ error: 'Send 1 to 500 attempts' });

    const rows = [];
    for (const a of list) {
      const ok = typeof a?.client_id === 'string' && a.client_id.length <= 64 &&
        SHAPES.includes(a.shape) && MODES.includes(a.mode) &&
        typeof a.score === 'number' && a.score >= 0 && a.score <= 100 &&
        typeof a.created_at === 'number' &&
        (a.daily_date == null || DATE.test(a.daily_date));
      if (!ok) return void res.status(400).json({ error: 'Bad attempt data' });
      rows.push({
        client_id: a.client_id, shape: a.shape, mode: a.mode,
        limit_s: typeof a.limit_s === 'number' ? a.limit_s : null,
        off_hand: a.off_hand ? 1 : 0, score: a.score,
        daily_date: a.daily_date ?? null, created_at: a.created_at,
      });
    }
    res.json({ stored: db.insertAttempts(res.locals.playerId, rows) });
  });

  r.get('/attempts', (_req, res) => {
    const attempts = db.attempts(res.locals.playerId).map((a) => ({ ...a, off_hand: a.off_hand === 1 }));
    res.json({ attempts });
  });

  r.post('/badges', (req, res) => {
    const ids = new Set(BADGES.map((b) => b.id));
    const list = Array.isArray(req.body?.badges) ? req.body.badges : [];
    const rows = list
      .filter((b: { badge_id?: unknown; earned_at?: unknown }) => typeof b?.badge_id === 'string' && ids.has(b.badge_id) && typeof b.earned_at === 'number')
      .map((b: { badge_id: string; earned_at: number }) => ({ badge_id: b.badge_id, earned_at: b.earned_at }));
    db.insertBadges(res.locals.playerId, rows);
    res.json({ ok: true });
  });

  return r;
}
