// Square, triangle and star scoring (Functional Design, "Scoring by shape"):
// 1. Build the ideal shape around the dot.
// 2. Try every rotation in 1 degree steps; for each, pick the size that fits best.
// 3. d = mean distance from each stroke point to the nearest edge of the ideal shape,
//    R = the ideal shape's mean radius.
// 4. Corner coverage: each corner needs a stroke point within 12% of R.
// score = max(0, 100 × (1 − k × d / R)) × corner coverage

import { STRICTNESS } from './circle';
import { template, type PolygonShape } from './templates';
import type { Centre, Stroke } from './types';

export const CORNER_REACH = 0.12; // a corner counts if a point is within 12% of R

type XY = { x: number; y: number };

export interface PolygonFit {
  score: number;       // 0 to 100
  coverage: number;    // share of corners reached, 0 to 1
  d: number;           // mean distance to the outline, in px
  R: number;           // the ideal shape's mean radius, in px
  scale: number;       // distance from the centre to a corner, in px
  rotationDeg: number;
  outline: XY[];       // the fitted ideal shape's corners, in screen px
  errors: number[];    // each point's distance to the outline divided by R
}

/** Shortest distance from point p to the line segment a–b. */
export function distToSegment(p: XY, a: XY, b: XY): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t)); // stay on the segment
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Shortest distance from p to a closed outline. */
export function distToOutline(p: XY, outline: XY[]): number {
  let best = Infinity;
  for (let i = 0; i < outline.length; i++) {
    best = Math.min(best, distToSegment(p, outline[i], outline[(i + 1) % outline.length]));
  }
  return best;
}

/** How far a ray from (0,0) in direction (ux, uy) travels before it hits the outline. */
function rayToOutline(ux: number, uy: number, outline: XY[]): number {
  let hit = 0;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const denom = ux * ey - uy * ex;
    if (Math.abs(denom) < 1e-12) continue; // ray parallel to this edge
    const t = (a.x * ey - a.y * ex) / denom;  // distance along the ray
    const s = (a.x * uy - a.y * ux) / denom;  // position along the edge (0..1)
    if (t > 0 && s >= -1e-9 && s <= 1 + 1e-9) hit = Math.max(hit, t);
  }
  return hit;
}

function rotate(points: XY[], deg: number, scale = 1, dx = 0, dy = 0): XY[] {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return points.map((p) => ({ x: dx + scale * (p.x * c - p.y * s), y: dy + scale * (p.x * s + p.y * c) }));
}

/** Mean distance from the centre to the outline of a unit shape (walks along its edges). */
const meanRadiusCache = new Map<PolygonShape, number>();
export function unitMeanRadius(shape: PolygonShape): number {
  const cached = meanRadiusCache.get(shape);
  if (cached !== undefined) return cached;
  const v = template(shape).vertices;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < v.length; i++) {
    const a = v[i];
    const b = v[(i + 1) % v.length];
    for (let k = 0; k < 200; k++) {
      const f = (k + 0.5) / 200;
      sum += Math.hypot(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f);
      count++;
    }
  }
  // weight each edge equally by length: all edges of these shapes are the same length
  const value = sum / count;
  meanRadiusCache.set(shape, value);
  return value;
}

/** The ideal outline in screen px, e.g. for the shape hint. */
export function idealOutline(shape: PolygonShape, centre: Centre, scale: number, rotationDeg = 0): XY[] {
  return rotate(template(shape).vertices, rotationDeg, scale, centre.cx, centre.cy);
}

export function scorePolygon(stroke: Stroke, shape: PolygonShape, centre: Centre, k = STRICTNESS): PolygonFit {
  const tpl = template(shape);
  const R1 = unitMeanRadius(shape);
  const rel = stroke.map((p) => ({ x: p.x - centre.cx, y: p.y - centre.cy }));
  const radii = rel.map((p) => Math.hypot(p.x, p.y));

  let best = { dOverR: Infinity, rot: 0, scale: 0, d: 0 };
  if (rel.length === 0) best.dOverR = 1;

  for (let rot = 0; rot < tpl.symmetryDeg && rel.length > 0; rot++) {
    const unit = rotate(tpl.vertices, rot);

    // Best size: the ideal edge in each point's direction is scale × rho.
    // Least squares gives scale = Σ(r·rho) / Σ(rho²).
    let num = 0;
    let den = 0;
    for (let i = 0; i < rel.length; i++) {
      if (radii[i] === 0) continue;
      const rho = rayToOutline(rel[i].x / radii[i], rel[i].y / radii[i], unit);
      num += radii[i] * rho;
      den += rho * rho;
    }
    const scale = den === 0 ? 0 : num / den;
    if (scale <= 0) continue;

    const outline = unit.map((p) => ({ x: p.x * scale, y: p.y * scale }));
    let sum = 0;
    for (const p of rel) sum += distToOutline(p, outline);
    const d = sum / rel.length;
    const dOverR = d / (scale * R1);
    if (dOverR < best.dOverR) best = { dOverR, rot, scale, d };
  }

  const R = best.scale * R1;
  const outline = rotate(tpl.vertices, best.rot, best.scale, centre.cx, centre.cy);

  // Corner coverage
  let reached = 0;
  for (const ci of tpl.corners) {
    const corner = outline[ci];
    const near = stroke.some((p) => Math.hypot(p.x - corner.x, p.y - corner.y) <= CORNER_REACH * R);
    if (near) reached++;
  }
  const coverage = reached / tpl.corners.length;

  const base = R > 0 ? Math.max(0, 100 * (1 - k * best.dOverR)) : 0;
  const errors = R > 0 ? stroke.map((p) => distToOutline(p, outline) / R) : stroke.map(() => 1);

  return {
    score: Math.min(100, base * coverage),
    coverage,
    d: best.d,
    R,
    scale: best.scale,
    rotationDeg: best.rot,
    outline,
    errors,
  };
}
