// App-wide state: settings, today's date, login, and saving results.

import { api } from './data/api';
import { allAttempts, kvGet, kvSet, newId, saveAttempt, type Attempt } from './data/indexeddb';
import { pullAttempts, syncPending } from './data/sync';
import { dailyChallenge } from './daily/seed';
import { checkBadges, badgeById, type Badge } from './progression/badges';
import { currentStreak, streakFromDates, type StreakState } from './progression/streak';
import type { PlaySettings } from './modes';
import type { TimeLimit } from './modes/timed';
import type { Stroke } from './scoring/types';

// ---- settings (kept in localStorage: they are per device and needed instantly) ----

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  sound: boolean;
  offHandDefault: boolean;
  last: Omit<PlaySettings, 'offHand'>;
  dateOverride: string | null; // business testing only
}

const SETTINGS_KEY = 'pc-settings';
const DEFAULTS: Settings = {
  theme: 'system', sound: true, offHandDefault: false,
  last: { shape: 'circle', mode: 'classic', limitS: 5 as TimeLimit },
  dateOverride: null,
};

export function getSettings(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch };
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  applyTheme(next);
  return next;
}

export function applyTheme(s = getSettings()) {
  if (s.theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = s.theme;
}

// ---- dates (UTC, with the test-only override) ----

// Remembered from the last visit so dates are right from the first screen in test mode.
let testMode = (() => { try { return localStorage.getItem('pc-test-mode') === '1'; } catch { return false; } })();
export const isTestMode = () => testMode;

export function today(): string {
  const o = getSettings().dateOverride;
  return testMode && o ? o : new Date().toISOString().slice(0, 10);
}

export const todaysChallenge = () => dailyChallenge(today());

// ---- login ----

let nickname: string | null = null;
let serverReachable = false;
const listeners = new Set<() => void>();

export const session = () => ({ nickname, serverReachable });
export function onSessionChange(fn: () => void) { listeners.add(fn); return () => listeners.delete(fn); }
const changed = () => listeners.forEach((fn) => fn());

/** Called once at start: finds the server, the logged-in player and test mode. */
export async function connect() {
  nickname = (await kvGet<string>('nickname')) ?? null;
  try {
    testMode = (await api.config()).testMode;
    try { localStorage.setItem('pc-test-mode', testMode ? '1' : '0'); } catch { /* private mode */ }
    serverReachable = true;
    try {
      const me = await api.me();
      nickname = me.nickname;
      await kvSet('nickname', nickname);
      await syncNow();
    } catch {
      nickname = null; // not logged in (or session expired)
      await kvSet('nickname', null);
    }
  } catch {
    serverReachable = false; // offline or server stopped: solo play still works
  }
  changed();
}

export async function login(nick: string, pin: string) {
  const me = await api.login(nick, pin);
  nickname = me.nickname;
  serverReachable = true;
  await kvSet('nickname', nickname);
  await syncNow();
  changed();
}

export async function logout() {
  try { await api.logout(); } catch { /* offline */ }
  nickname = null;
  await kvSet('nickname', null);
  changed();
}

export async function rename(nick: string) {
  const me = await api.rename(nick);
  nickname = me.nickname;
  await kvSet('nickname', nickname);
  changed();
}

/** Upload queued attempts, download other devices' attempts, share badges. */
export async function syncNow(): Promise<string> {
  if (!nickname) return 'Not signed in';
  const up = await syncPending();
  if (up.error) { serverReachable = false; changed(); return 'Could not reach the PC server'; }
  serverReachable = true;
  try {
    await postDaily(today());
    await pullAttempts();
    const me = await api.me();
    const earned = await earnedBadges();
    for (const b of me.badges) earned[b.badge_id] ??= b.earned_at;       // from other devices
    await kvSet('badges', earned);
    await refreshBadges();                                               // recalculated here
    await api.postBadges(Object.entries(await earnedBadges()).map(([badge_id, earned_at]) => ({ badge_id, earned_at })));
  } catch { /* keep what we have */ }
  return up.sent ? `Synced ${up.sent} attempt${up.sent === 1 ? '' : 's'}` : 'Up to date';
}

// ---- progression ----

export async function earnedBadges(): Promise<Record<string, number>> {
  return (await kvGet<Record<string, number>>('badges')) ?? {};
}

export async function duelWins(): Promise<number> {
  return (await kvGet<number>('duelWins')) ?? 0;
}

export async function streak(): Promise<StreakState & { shown: number }> {
  const attempts = await allAttempts();
  const s = streakFromDates(attempts.filter((a) => a.daily_date).map((a) => a.daily_date!));
  return { ...s, shown: currentStreak(s, today()) };
}

/** Works out newly earned badges from all attempts, saves them, and returns them. */
export async function refreshBadges(): Promise<Badge[]> {
  const attempts = await allAttempts();
  const earned = await earnedBadges();
  const st = await streak();
  const fresh = checkBadges(attempts, Object.keys(earned), { bestStreak: st.best, duelWins: await duelWins() });
  if (fresh.length) {
    const now = Date.now();
    for (const id of fresh) earned[id] = now;
    await kvSet('badges', earned);
  }
  return fresh.map((id) => badgeById(id)!);
}

export interface Saved { attempt: Attempt; newBadges: Badge[]; best: boolean }

/** Saves a valid attempt, updates badges, and uploads it if logged in. */
export async function recordAttempt(settings: PlaySettings, score: number, dailyDate: string | null = null): Promise<Saved> {
  const before = await allAttempts();
  const best = !before.some((a) => a.shape === settings.shape && a.score >= score);
  const attempt: Attempt = {
    client_id: newId(),
    shape: settings.shape,
    mode: settings.mode,
    limit_s: settings.mode === 'timed' ? settings.limitS ?? 5 : null,
    off_hand: settings.offHand,
    score,
    daily_date: dailyDate,
    created_at: Date.now(),
  };
  await saveAttempt(attempt);
  const newBadges = await refreshBadges();
  if (nickname) void syncNow();
  return { attempt, newBadges, best };
}

export async function addDuelWin(): Promise<Badge[]> {
  await kvSet('duelWins', (await duelWins()) + 1);
  const fresh = await refreshBadges();
  if (nickname) void syncNow();
  return fresh;
}

/** Best score so far for a shape (for the Play screen header). */
export async function bestFor(shape: string): Promise<number | null> {
  const list = (await allAttempts()).filter((a) => a.shape === shape);
  return list.length ? Math.max(...list.map((a) => a.score)) : null;
}

// ---- daily result on this device ----

export interface DailyRecord {
  date: string;
  score: number;
  errors: number[];
  stroke: Stroke;              // 128 points, sent to the server for the leaderboard
  serverScore?: number | null; // the score the PC server calculated
  posted?: boolean;
}

export const getDaily = (date: string) => kvGet<DailyRecord>('daily:' + date);
export const setDaily = (r: DailyRecord) => kvSet('daily:' + r.date, r);

/** Sends today's daily stroke to the server (the server scores it again itself). */
export async function postDaily(date: string): Promise<DailyRecord | undefined> {
  const r = await getDaily(date);
  if (!r || r.posted || !nickname) return r;
  try {
    const reply = await api.postDaily(date, r.stroke);
    r.serverScore = reply.score;
    r.posted = true;
    await setDaily(r);
  } catch { /* try again at the next sync */ }
  return r;
}

// Upload when the connection comes back
window.addEventListener('online', () => { if (nickname) void syncNow(); });
