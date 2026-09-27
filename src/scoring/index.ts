// One function that validates and scores an attempt for any shape and mode.
// The browser AND the server call scoreAttempt() with the same 128-point stroke,
// so both always get the same score.
//
// The stroke it receives is measured from the dot's resting place (0, 0),
// and each point's t is in ms since the round started.

import { resample } from '../input/resample';
import { relativeToDot } from '../modes/moving';
import { timeLimitMs, type Mode } from '../modes';
import { pointErrors, meanRadius, scoreCircle } from './circle';
import { scorePolygon } from './polygon';
import type { Shape } from './templates';
import type { Centre, Stroke } from './types';
import { validate, type RejectReason } from './validate';

export const ORIGIN: Centre = { cx: 0, cy: 0 };

/** The ideal shape to draw on top of the stroke. */
export type Ideal =
  | { kind: 'circle'; r: number }
  | { kind: 'polygon'; points: { x: number; y: number }[] };

export interface ShapeScore {
  score: number;      // unrounded, 0 to 100
  coverage: number;   // 1 for circles
  errors: number[];   // one per point, as a fraction of R
  ideal: Ideal;       // measured from the centre, so it can be drawn around any dot
  R: number;          // the ideal shape's mean radius in px
}

export function scoreShape(stroke: Stroke, shape: Shape, centre: Centre): ShapeScore {
  if (shape === 'circle') {
    const R = meanRadius(stroke, centre);
    return {
      score: scoreCircle(stroke, centre),
      coverage: 1,
      errors: pointErrors(stroke, centre),
      ideal: { kind: 'circle', r: R },
      R,
    };
  }
  const fit = scorePolygon(stroke, shape, centre);
  // the outline is stored relative to the centre so it can be drawn anywhere
  const points = fit.outline.map((p) => ({ x: p.x - centre.cx, y: p.y - centre.cy }));
  return { score: fit.score, coverage: fit.coverage, errors: fit.errors, ideal: { kind: 'polygon', points }, R: fit.R };
}

/** FR-03: scores have one decimal. */
export const round1 = (x: number) => Math.round(x * 10) / 10;

export type AttemptScore =
  | { ok: false; reason: RejectReason }
  | ({ ok: true; score: number; scored: Stroke } & Omit<ShapeScore, 'score'>);

export interface AttemptOptions {
  shape: Shape;
  mode: Mode;
  limitS?: number;
}

/**
 * stroke128: resampled stroke, relative to the dot's resting place, t since round start.
 * Returns the reason it failed, or the one-decimal score plus what to draw on Result.
 */
export function scoreAttempt(stroke128: Stroke, opts: AttemptOptions): AttemptScore {
  // In moving-dot mode, shift every point by where the dot was at that moment.
  const placed = opts.mode === 'moving' ? relativeToDot(stroke128, ORIGIN) : stroke128;

  const check = validate(placed, {
    ...ORIGIN,
    timeLimitMs: timeLimitMs({ mode: opts.mode, limitS: opts.limitS as 5 | 3 | 2 | undefined }),
  });
  if (!check.ok) return check;

  const scored = opts.mode === 'moving' ? resample(placed) : placed;
  const result = scoreShape(scored, opts.shape, ORIGIN);
  return { ok: true, ...result, score: round1(result.score), scored };
}
