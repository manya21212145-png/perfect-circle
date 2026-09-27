// Badges (Functional Design, badge table). The list lives in code; earned badges are saved.

import type { Shape } from '../scoring/templates';
import type { Mode } from '../modes';

export interface BadgeAttempt {
  shape: Shape;
  mode: Mode;
  off_hand: boolean;
  score: number;
}

export interface BadgeContext {
  bestStreak: number;
  duelWins: number;
}

export interface Badge {
  id: string;
  name: string;
  how: string;
  earned(attempts: BadgeAttempt[], ctx: BadgeContext): boolean;
}

const any = (list: BadgeAttempt[], test: (a: BadgeAttempt) => boolean) => list.some(test);

export const BADGES: Badge[] = [
  { id: 'first_circle', name: 'First circle', how: 'Complete any valid attempt', earned: (a) => a.length > 0 },
  { id: 'sharp_eye', name: 'Sharp eye', how: 'First score of 90% or more', earned: (a) => any(a, (x) => x.score >= 90) },
  { id: 'nearly_perfect', name: 'Nearly perfect', how: 'First score of 95% or more', earned: (a) => any(a, (x) => x.score >= 95) },
  { id: 'human_compass', name: 'Human compass', how: 'First score of 99% or more', earned: (a) => any(a, (x) => x.score >= 99) },
  {
    id: 'shape_master', name: 'Shape master', how: '85% or more on all four shapes',
    earned: (a) => (['circle', 'square', 'triangle', 'star'] as Shape[]).every((s) => any(a, (x) => x.shape === s && x.score >= 85)),
  },
  { id: 'ink_ghost', name: 'Ink ghost', how: '90% or more in disappearing ink mode', earned: (a) => any(a, (x) => x.mode === 'ink' && x.score >= 90) },
  { id: 'moving_target', name: 'Moving target', how: '85% or more in moving dot mode', earned: (a) => any(a, (x) => x.mode === 'moving' && x.score >= 85) },
  { id: 'other_hand', name: 'Other hand', how: '80% or more with non-dominant hand on', earned: (a) => any(a, (x) => x.off_hand && x.score >= 80) },
  { id: 'week_streak', name: 'Week streak', how: '7-day daily streak', earned: (_a, c) => c.bestStreak >= 7 },
  { id: 'month_streak', name: 'Month streak', how: '30-day daily streak', earned: (_a, c) => c.bestStreak >= 30 },
  { id: 'first_blood', name: 'First blood', how: 'Win a first duel', earned: (_a, c) => c.duelWins >= 1 },
  { id: 'duelist', name: 'Duelist', how: 'Win 10 duels', earned: (_a, c) => c.duelWins >= 10 },
];

/** Returns the ids of badges earned now that were not already in `alreadyEarned`. */
export function checkBadges(attempts: BadgeAttempt[], alreadyEarned: Iterable<string>, ctx: BadgeContext): string[] {
  const have = new Set(alreadyEarned);
  return BADGES.filter((b) => !have.has(b.id) && b.earned(attempts, ctx)).map((b) => b.id);
}

export const badgeById = (id: string) => BADGES.find((b) => b.id === id);
