// UT-04 to UT-08 (circle scoring)
import { describe, expect, it } from 'vitest';
import { scoreCircle } from '../../src/scoring/circle';
import { resample } from '../../src/input/resample';
import { makeCircle, makeEllipse, makeScribble } from '../helpers/strokes';

const centre = { cx: 400, cy: 400 };

describe('scoreCircle', () => {
  it('UT-04 scores a perfect circle (radius 150 px) at 99.9% or more', () => {
    const stroke = makeCircle({ cx: 400, cy: 400, r: 150, points: 128 });
    expect(scoreCircle(stroke, centre)).toBeGreaterThanOrEqual(99.9);
  });

  it('UT-05 scores a circle with ±5% noise between 92% and 95%', () => {
    const stroke = makeCircle({ cx: 400, cy: 400, r: 150, points: 128, noise: 0.05, seed: 5 });
    const score = scoreCircle(stroke, centre);
    expect(score).toBeGreaterThanOrEqual(92);
    expect(score).toBeLessThanOrEqual(95);
  });

  it('UT-06 scores a 150 × 100 px ellipse below 75%', () => {
    const stroke = resample(makeEllipse({ cx: 400, cy: 400, rx: 150, ry: 100, points: 200 }));
    expect(scoreCircle(stroke, centre)).toBeLessThan(75);
  });

  it('UT-07 keeps every score between 0 and 100 for 50 random scribbles', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const score = scoreCircle(resample(makeScribble(seed)), centre);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('UT-08 gives the same score at radius 80 px and 300 px (within 0.1)', () => {
    const small = makeCircle({ cx: 400, cy: 400, r: 80, points: 128, noise: 0.04, seed: 8 });
    const large = makeCircle({ cx: 400, cy: 400, r: 300, points: 128, noise: 0.04, seed: 8 });
    expect(Math.abs(scoreCircle(small, centre) - scoreCircle(large, centre))).toBeLessThanOrEqual(0.1);
  });
});
