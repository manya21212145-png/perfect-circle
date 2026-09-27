// Daily challenge: the shape and mode come from a hash of the UTC date,
// so every device picks the same challenge without asking the server.

import { SHAPES, type Shape } from '../scoring/templates';
import { MODES, type Mode } from '../modes';
import { TIME_LIMITS_S, type TimeLimit } from '../modes/timed';

/** Challenge #1 is 2026-09-27 (the number counts days since launch day). */
export const LAUNCH_DATE = '2026-09-26';
const DAY_MS = 86_400_000;

export interface DailyChallenge {
  number: number;
  date: string;       // 'YYYY-MM-DD' in UTC
  shape: Shape;
  mode: Mode;
  limitS?: TimeLimit; // only for timed mode
}

/** A Date (or 'YYYY-MM-DD' text) → 'YYYY-MM-DD' in UTC. */
export function utcDate(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

/** Whole days from date a to date b ('YYYY-MM-DD'). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY_MS);
}

/** 'YYYY-MM-DD' plus n days. */
export function addDays(date: string, n: number): string {
  return new Date(Date.parse(date + 'T00:00:00Z') + n * DAY_MS).toISOString().slice(0, 10);
}

/** FNV-1a: turns text into a well-mixed 32-bit number. */
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function dailyChallenge(when: Date | string): DailyChallenge {
  const date = utcDate(when);
  const h = hash('perfect-circle:' + date);
  const combo = h % (SHAPES.length * MODES.length);          // 16 shape+mode pairs
  const shape = SHAPES[combo % SHAPES.length];
  const mode = MODES[Math.floor(combo / SHAPES.length)];
  const challenge: DailyChallenge = { number: daysBetween(LAUNCH_DATE, date), date, shape, mode };
  if (mode === 'timed') challenge.limitS = TIME_LIMITS_S[Math.floor(h / 16) % TIME_LIMITS_S.length];
  return challenge;
}
