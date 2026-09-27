// Data for the history graph on Profile:
//  - one dot per attempt
//  - a line through each day's best score
//  - a 7-day moving average: the average of the daily bests over that day and the 6 before it
// Days are UTC days, the same as the daily challenge and streak.

import type { Shape } from '../scoring/templates';
import type { Mode } from '../modes';
import { addDays } from '../daily/seed';

export interface HistoryAttempt {
  shape: Shape;
  mode: Mode;
  off_hand: boolean;
  score: number;
  created_at: number; // ms since 1970
}

export interface HistoryFilter {
  shape?: Shape | 'all';
  mode?: Mode | 'all';
  /** true = only non-dominant-hand attempts; false or missing = all attempts. */
  offHandOnly?: boolean;
  /** Only the last 7, 30 or 90 days (counting from `now`). Missing = everything. */
  days?: number;
  now?: number;
}

export interface HistorySeries {
  points: { t: number; score: number }[];
  days: { date: string; best: number; avg7: number }[];
}

const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function filterAttempts<T extends HistoryAttempt>(attempts: T[], f: HistoryFilter = {}): T[] {
  const since = f.days ? (f.now ?? Date.now()) - f.days * 86_400_000 : -Infinity;
  return attempts.filter((a) =>
    (!f.shape || f.shape === 'all' || a.shape === f.shape) &&
    (!f.mode || f.mode === 'all' || a.mode === f.mode) &&
    (!f.offHandOnly || a.off_hand) &&
    a.created_at >= since);
}

export function historySeries(attempts: HistoryAttempt[], filter: HistoryFilter = {}): HistorySeries {
  const list = filterAttempts(attempts, filter).sort((a, b) => a.created_at - b.created_at);
  const points = list.map((a) => ({ t: a.created_at, score: a.score }));

  // best score per day
  const bestByDay = new Map<string, number>();
  for (const a of list) {
    const d = dayOf(a.created_at);
    bestByDay.set(d, Math.max(bestByDay.get(d) ?? -Infinity, a.score));
  }

  const days = [...bestByDay.keys()].sort().map((date) => {
    const window: number[] = [];
    for (let i = 0; i < 7; i++) {
      const v = bestByDay.get(addDays(date, -i));
      if (v !== undefined) window.push(v);
    }
    const avg7 = Math.round((window.reduce((s, v) => s + v, 0) / window.length) * 10) / 10;
    return { date, best: bestByDay.get(date)!, avg7 };
  });

  return { points, days };
}
