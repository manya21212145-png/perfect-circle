// Resampling: turn a stroke with uneven gaps into n points that are evenly spaced
// along the line. Fast and slow drawers then get scored the same way.

import type { Point, Stroke } from '../scoring/types';

export const SAMPLE_POINTS = 128;

/** Total length of the line through all the points. */
export function pathLength(points: Stroke): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

export function resample(points: Stroke, n = SAMPLE_POINTS): Stroke {
  // A single point (or a line of length 0) cannot be spread out: return an empty stroke.
  const total = pathLength(points);
  if (points.length < 2 || n < 2 || total === 0) return [];

  // cum[i] = distance along the line from the first point to point i
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }

  const step = total / (n - 1);
  const out: Point[] = [];
  let seg = 1; // the segment we are walking along: from points[seg-1] to points[seg]

  for (let k = 0; k < n; k++) {
    const target = k === n - 1 ? total : k * step; // distance along the line for point k
    while (seg < points.length - 1 && cum[seg] < target) seg++;

    const a = points[seg - 1];
    const b = points[seg];
    const segLen = cum[seg] - cum[seg - 1];
    const f = segLen === 0 ? 0 : (target - cum[seg - 1]) / segLen; // 0 = at a, 1 = at b
    out.push({
      x: a.x + (b.x - a.x) * f,
      y: a.y + (b.y - a.y) * f,
      t: a.t + (b.t - a.t) * f,
    });
  }
  return out;
}
