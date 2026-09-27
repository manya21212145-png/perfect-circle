// Test stroke generators (Unit Test Document, "Strategy"): perfect circle, noisy
// circle, ellipse and scribbles, with a fixed random seed so results never change.

import type { Point, Stroke } from '../../src/scoring/types';

/** A tiny seeded random number generator (mulberry32). Same seed = same numbers. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface CircleOptions {
  cx: number;
  cy: number;
  r: number;
  points: number;
  /** How much of a full turn to draw: 1 = full circle, 0.93 = 93%. Default 1. */
  turns?: number;
  /** Random change to the radius, as a fraction: 0.05 means ±5%. Default 0. */
  noise?: number;
  seed?: number;
  /** Time the whole stroke takes, in ms. Default 2000. */
  durationMs?: number;
}

export function makeCircle(o: CircleOptions): Stroke {
  const rand = seededRandom(o.seed ?? 1);
  const turns = o.turns ?? 1;
  const duration = o.durationMs ?? 2000;
  const out: Point[] = [];
  for (let i = 0; i < o.points; i++) {
    const f = i / (o.points - 1);            // 0 at the start, 1 at the end
    const angle = f * turns * Math.PI * 2;
    const r = o.r * (1 + (o.noise ?? 0) * (rand() * 2 - 1));
    out.push({ x: o.cx + r * Math.cos(angle), y: o.cy + r * Math.sin(angle), t: f * duration });
  }
  return out;
}

export function makeEllipse(o: { cx: number; cy: number; rx: number; ry: number; points: number }): Stroke {
  const out: Point[] = [];
  for (let i = 0; i < o.points; i++) {
    const f = i / (o.points - 1);
    const angle = f * Math.PI * 2;
    out.push({ x: o.cx + o.rx * Math.cos(angle), y: o.cy + o.ry * Math.sin(angle), t: f * 2000 });
  }
  return out;
}

/** A random wiggly line anywhere on an 800 × 800 area. */
export function makeScribble(seed: number, points = 128): Stroke {
  const rand = seededRandom(seed);
  const out: Point[] = [];
  for (let i = 0; i < points; i++) out.push({ x: rand() * 800, y: rand() * 800, t: i * 10 });
  return out;
}

/**
 * Goes forward by `before` radians, back by `back` radians, then forward again
 * until `total` radians past the start. Used for the "wrong way" tests.
 */
export function makeBacktrack(o: { cx: number; cy: number; r: number; before: number; back: number; total: number }): Stroke {
  const stepSize = 0.02; // radians between points
  const angles: number[] = [];
  for (let a = 0; a < o.before; a += stepSize) angles.push(a);
  for (let a = o.before; a > o.before - o.back; a -= stepSize) angles.push(a);
  angles.push(o.before - o.back);
  for (let a = o.before - o.back; a < o.total; a += stepSize) angles.push(a);
  angles.push(o.total);
  return angles.map((a, i) => ({ x: o.cx + o.r * Math.cos(a), y: o.cy + o.r * Math.sin(a), t: i * 5 }));
}
