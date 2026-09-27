// The four modes and the settings chosen on the Setup screen.

import type { Shape } from '../scoring/templates';
import { CLASSIC_TIME_LIMIT_MS } from '../scoring/validate';
import type { TimeLimit } from './timed';

export type Mode = 'classic' | 'timed' | 'ink' | 'moving';
export const MODES: Mode[] = ['classic', 'timed', 'ink', 'moving'];

export interface PlaySettings {
  shape: Shape;
  mode: Mode;
  /** Seconds, only used in timed mode. */
  limitS?: TimeLimit;
  /** "I'm using my other hand". Can be combined with any mode. */
  offHand: boolean;
}

export function timeLimitMs(s: Pick<PlaySettings, 'mode' | 'limitS'>): number {
  return s.mode === 'timed' ? (s.limitS ?? 5) * 1000 : CLASSIC_TIME_LIMIT_MS;
}

export function modeName(s: Pick<PlaySettings, 'mode' | 'limitS'>): string {
  switch (s.mode) {
    case 'classic': return 'Classic';
    case 'timed': return `${s.limitS ?? 5} s time limit`;
    case 'ink': return 'Disappearing ink';
    case 'moving': return 'Moving dot';
  }
}
