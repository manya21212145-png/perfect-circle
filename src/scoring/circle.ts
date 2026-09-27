// Circle scoring from the Functional Design ("Scoring by shape"):
//   R = mean distance of the points from the dot
//   d = mean of |distance - R|
//   score = max(0, 100 × (1 − k × d / R)), with k = 2.5
// The stroke should already be resampled to 128 points (see input/resample.ts).

import type { Centre, Stroke } from './types';

export const STRICTNESS = 2.5; // k in the formula

/** Distance of every point from the dot. */
export function radii(stroke: Stroke, centre: Centre): number[] {
  return stroke.map((p) => Math.hypot(p.x - centre.cx, p.y - centre.cy));
}

/** R: the ideal radius, i.e. the average distance from the dot. */
export function meanRadius(stroke: Stroke, centre: Centre): number {
  if (stroke.length === 0) return 0;
  const r = radii(stroke, centre);
  return r.reduce((sum, v) => sum + v, 0) / r.length;
}

/** Error of each point as a fraction of R (0.05 = 5% off). Used to colour the line. */
export function pointErrors(stroke: Stroke, centre: Centre): number[] {
  const R = meanRadius(stroke, centre);
  if (R === 0) return stroke.map(() => 0);
  return radii(stroke, centre).map((r) => Math.abs(r - R) / R);
}

/** Score from 0 to 100. */
export function scoreCircle(stroke: Stroke, centre: Centre, k = STRICTNESS): number {
  const R = meanRadius(stroke, centre);
  if (R === 0) return 0;
  const errors = pointErrors(stroke, centre);
  const dOverR = errors.reduce((sum, e) => sum + e, 0) / errors.length;
  const score = 100 * (1 - k * dOverR);
  return Math.min(100, Math.max(0, score));
}
