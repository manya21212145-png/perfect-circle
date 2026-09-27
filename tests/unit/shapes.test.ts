// UT-09 to UT-14 (square, triangle and star scoring)
import { describe, expect, it } from 'vitest';
import { scorePolygon } from '../../src/scoring/polygon';
import { STRICTNESS } from '../../src/scoring/circle';
import { makeCircle, makePolygon } from '../helpers/strokes';

const centre = { cx: 400, cy: 400 };

describe('scorePolygon', () => {
  it('UT-09 scores a perfect square at 99% or more', () => {
    const stroke = makePolygon({ shape: 'square', cx: 400, cy: 400, size: 150 });
    expect(scorePolygon(stroke, 'square', centre).score).toBeGreaterThanOrEqual(99);
  });

  it('UT-10 scores a perfect square rotated 37 degrees at 99% or more (rotation fitted)', () => {
    const stroke = makePolygon({ shape: 'square', cx: 400, cy: 400, size: 150, rotationDeg: 37 });
    const fit = scorePolygon(stroke, 'square', centre);
    expect(fit.score).toBeGreaterThanOrEqual(99);
    expect(fit.rotationDeg).toBe(37);
  });

  it('UT-11 gives a circle drawn for a square corner coverage below 1 and a score below 75', () => {
    const stroke = makeCircle({ cx: 400, cy: 400, r: 150, points: 128 });
    const fit = scorePolygon(stroke, 'square', centre);
    expect(fit.coverage).toBeLessThan(1);
    expect(fit.score).toBeLessThan(75);
  });

  it('UT-12 scores a perfect triangle at 99% or more', () => {
    const stroke = makePolygon({ shape: 'triangle', cx: 400, cy: 400, size: 150 });
    expect(scorePolygon(stroke, 'triangle', centre).score).toBeGreaterThanOrEqual(99);
  });

  it('UT-13 scores a perfect 5-point star at 99% or more', () => {
    const stroke = makePolygon({ shape: 'star', cx: 400, cy: 400, size: 150 });
    expect(scorePolygon(stroke, 'star', centre).score).toBeGreaterThanOrEqual(99);
  });

  it('UT-14 applies corner coverage 0.8 to a star with one arm missing', () => {
    const stroke = makePolygon({ shape: 'star', cx: 400, cy: 400, size: 150, skip: [2] });
    const fit = scorePolygon(stroke, 'star', centre);
    expect(fit.coverage).toBeCloseTo(0.8, 5);
    const withoutCoverage = Math.max(0, 100 * (1 - (STRICTNESS * fit.d) / fit.R));
    expect(fit.score).toBeCloseTo(withoutCoverage * 0.8, 5);
  });
});
