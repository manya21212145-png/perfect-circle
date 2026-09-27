// Daily streak: +1 for each UTC day with a completed daily challenge.
// Missing a day resets it to 0. The best streak is kept.

import { addDays, daysBetween } from '../daily/seed';

export interface StreakState {
  current: number;
  best: number;
  lastDate: string | null; // last day a daily was completed ('YYYY-MM-DD')
}

export const EMPTY_STREAK: StreakState = { current: 0, best: 0, lastDate: null };

/** Adds one completed daily on `date`. A second daily on the same day changes nothing. */
export function updateStreak(state: StreakState, date: string): StreakState {
  if (state.lastDate === date) return state;                       // same day: no change
  if (state.lastDate !== null && daysBetween(state.lastDate, date) < 0) return state; // older day
  const continues = state.lastDate !== null && daysBetween(state.lastDate, date) === 1;
  const current = continues ? state.current + 1 : 1;
  return { current, best: Math.max(state.best, current), lastDate: date };
}

/** Rebuilds the streak from every daily date (in any order, duplicates allowed). */
export function streakFromDates(dates: string[]): StreakState {
  const sorted = [...new Set(dates)].sort();
  return sorted.reduce(updateStreak, EMPTY_STREAK);
}

/** The streak to show today: 0 if yesterday's daily was missed. */
export function currentStreak(state: StreakState, today: string): number {
  if (state.lastDate === null) return 0;
  return state.lastDate === today || state.lastDate === addDays(today, -1) ? state.current : 0;
}
