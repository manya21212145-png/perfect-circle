// Calls to the PC server's REST API. The login cookie is sent automatically.

import type { Attempt } from './indexeddb';
import type { Stroke } from '../scoring/types';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? res.statusText);
  return data as T;
}

export interface Me { nickname: string; badges: { badge_id: string; earned_at: number }[] }
export interface ServerConfig { testMode: boolean }
export interface DailyReply { score: number | null; stored: boolean; reason?: string }
export interface LeaderRow { nickname: string; score: number }

export const api = {
  config: () => call<ServerConfig>('GET', '/api/config'),
  login: (nickname: string, pin: string) => call<Me>('POST', '/api/login', { nickname, pin }),
  logout: () => call<{ ok: true }>('POST', '/api/logout'),
  me: () => call<Me>('GET', '/api/me'),
  rename: (nickname: string) => call<Me>('PATCH', '/api/me', { nickname }),
  postAttempts: (attempts: Attempt[]) => call<{ stored: number }>('POST', '/api/attempts', { attempts }),
  getAttempts: () => call<{ attempts: Attempt[] }>('GET', '/api/attempts'),
  postBadges: (badges: { badge_id: string; earned_at: number }[]) => call<{ ok: true }>('POST', '/api/badges', { badges }),
  postDaily: (date: string, stroke: Stroke) => call<DailyReply>('POST', '/api/daily', { date, stroke }),
  leaderboard: (date: string) => call<{ rows: LeaderRow[] }>('GET', `/api/daily/${date}/leaderboard`),
};
