// POST /api/daily – takes the 128-point stroke of today's daily attempt.
// The server works out the score itself with the shared scoring module; any score the
// browser sends is ignored. Only the first scored attempt of the day is stored.

import { Router } from 'express';
import type { Db } from '../db';
import { requireLogin } from '../auth';
import { dailyChallenge, addDays } from '../../src/daily/seed';
import { scoreAttempt } from '../../src/scoring';
import type { Stroke } from '../../src/scoring/types';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isStroke(s: unknown): s is Stroke {
  return Array.isArray(s) && s.length >= 10 && s.length <= 256 &&
    s.every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.t));
}

export function dailyRoutes(db: Db, testMode: boolean) {
  const r = Router();

  r.post('/daily', requireLogin(db), (req, res) => {
    const date = String(req.body?.date ?? '');
    const stroke = req.body?.stroke;
    if (!DATE.test(date)) return void res.status(400).json({ error: 'Bad date' });
    if (!isStroke(stroke)) return void res.status(400).json({ error: 'Bad stroke' });

    // Only today's (or, near midnight, yesterday's) challenge — unless the server runs in test mode.
    const today = new Date().toISOString().slice(0, 10);
    if (!testMode && date !== today && date !== addDays(today, -1)) {
      return void res.status(400).json({ error: 'That daily challenge is closed' });
    }

    const playerId = res.locals.playerId as number;
    const existing = db.dailyScore(playerId, date);
    if (existing !== undefined) return void res.json({ score: existing, stored: false });

    const challenge = dailyChallenge(date);
    const result = scoreAttempt(stroke, challenge);
    if (!result.ok) return void res.json({ score: null, stored: false, reason: result.reason });

    const stored = db.insertDaily(playerId, date, result.score, JSON.stringify(stroke));
    res.json({ score: result.score, stored });
  });

  return r;
}
