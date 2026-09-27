// Wordle-style share text:
//   Perfect Circle #42  Star, disappearing ink
//   91.8%  🟩🟩🟩🟨🟩
//   Streak: 12 days

import { SHAPE_NAMES, type Shape } from '../scoring/templates';
import { modeName, type Mode } from '../modes';

export const GREEN = '🟩';
export const YELLOW = '🟨';
export const RED = '🟥';

/** Green under 3% error, yellow under 7%, red above. */
export function squareFor(error: number): string {
  if (error < 0.03) return GREEN;
  if (error < 0.07) return YELLOW;
  return RED;
}

/** Average error of each of `parts` equal parts of the stroke. */
export function segmentErrors(errors: number[], parts = 5): number[] {
  const out: number[] = [];
  for (let i = 0; i < parts; i++) {
    const from = Math.floor((i * errors.length) / parts);
    const to = Math.floor(((i + 1) * errors.length) / parts);
    const slice = errors.slice(from, Math.max(to, from + 1));
    out.push(slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : 0);
  }
  return out;
}

export interface ShareInput {
  number: number;
  shape: Shape;
  mode: Mode;
  limitS?: number;
  score: number;
  /** Per-point errors from scoring (any length), or exactly 5 segment errors. */
  errors: number[];
  streak: number;
}

export function shareText(r: ShareInput): string {
  const segments = r.errors.length === 5 ? r.errors : segmentErrors(r.errors, 5);
  const squares = segments.map(squareFor).join('');
  const mode = modeName({ mode: r.mode, limitS: r.limitS as 5 | 3 | 2 | undefined }).toLowerCase();
  return [
    `Perfect Circle #${r.number}  ${SHAPE_NAMES[r.shape]}, ${mode}`,
    `${r.score.toFixed(1)}%  ${squares}`,
    `Streak: ${r.streak} ${r.streak === 1 ? 'day' : 'days'}`,
  ].join('\n');
}
