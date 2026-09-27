// Moving dot mode: the dot glides along a figure-eight at a steady 30 px per second.
// Every stroke point is compared with where the dot was at that moment.

import type { Centre, Stroke } from '../scoring/types';

export const DOT_SPEED = 30;      // px per second
export const PATH_SIZE = 50;      // the figure-eight is 100 px wide and 50 px tall

type XY = { x: number; y: number };

// The figure-eight: x = A·sin(u), y = (A/2)·sin(2u). Moving through u at a steady rate
// would change speed along the curve, so we measure the curve's length once (a table of
// distances) and then move along it by distance instead.
const STEPS = 2000;
let table: { dist: number[]; pts: XY[]; length: number } | null = null;

function pathTable() {
  if (table) return table;
  const pts: XY[] = [];
  const dist: number[] = [0];
  for (let i = 0; i <= STEPS; i++) {
    const u = (i / STEPS) * Math.PI * 2;
    pts.push({ x: PATH_SIZE * Math.sin(u), y: (PATH_SIZE / 2) * Math.sin(2 * u) });
    if (i > 0) dist.push(dist[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  table = { dist, pts, length: dist[STEPS] };
  return table;
}

/** Where the dot is tMs after the round started. The same t always gives the same place. */
export function dotPosition(tMs: number, centre: Centre): XY {
  const { dist, pts, length } = pathTable();
  let s = ((DOT_SPEED * tMs) / 1000) % length; // distance travelled along the loop
  if (s < 0) s += length;

  // binary search for the table entry just before s
  let lo = 0;
  let hi = STEPS;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (dist[mid] <= s) lo = mid; else hi = mid;
  }
  const f = (s - dist[lo]) / (dist[hi] - dist[lo] || 1);
  return {
    x: centre.cx + pts[lo].x + (pts[hi].x - pts[lo].x) * f,
    y: centre.cy + pts[lo].y + (pts[hi].y - pts[lo].y) * f,
  };
}

/**
 * Moves every point as if the dot had stayed still at `centre`.
 * Point times (t) must be measured from the start of the round.
 */
export function relativeToDot(stroke: Stroke, centre: Centre): Stroke {
  return stroke.map((p) => {
    const dot = dotPosition(p.t, centre);
    return { x: p.x - (dot.x - centre.cx), y: p.y - (dot.y - centre.cy), t: p.t };
  });
}
