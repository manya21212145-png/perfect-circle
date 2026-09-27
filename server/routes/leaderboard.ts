// GET /api/daily/:date/leaderboard – top 100 nicknames and scores for that day.
// Only nicknames are sent, never PINs or ids (NFR-07).

import { Router } from 'express';
import type { Db } from '../db';

export function leaderboardRoutes(db: Db) {
  const r = Router();
  r.get('/daily/:date/leaderboard', (req, res) => {
    const date = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return void res.status(400).json({ error: 'Bad date' });
    res.json({ rows: db.topScores(date) });
  });
  return r;
}
