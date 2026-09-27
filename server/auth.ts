// Login cookie helpers: reads the session cookie and finds the logged-in player.

import type { NextFunction, Request, Response } from 'express';
import type { Db } from './db';

export const COOKIE = 'pc_session';
export const SESSION_DAYS = 30;

/** Turns "a=1; b=2" into { a: '1', b: '2' }. */
export function parseCookies(header = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function sessionToken(req: Request): string | undefined {
  return parseCookies(req.headers.cookie)[COOKIE];
}

/** The player id for this request, or undefined if not logged in. */
export function currentPlayer(req: Request, db: Db): number | undefined {
  const token = sessionToken(req);
  return token ? db.sessionPlayer(token) : undefined;
}

/** Route guard: answers 401 unless logged in; otherwise puts the id in res.locals.playerId. */
export function requireLogin(db: Db) {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = currentPlayer(req, db);
    if (id === undefined) {
      res.status(401).json({ error: 'Please log in' });
      return;
    }
    res.locals.playerId = id;
    next();
  };
}
