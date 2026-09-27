// UT-01 to UT-03 (input module)
import { describe, expect, it } from 'vitest';
import { resample } from '../../src/input/resample';
import { attachPointer, capture } from '../../src/input/capture';
import type { Point } from '../../src/scoring/types';
import { seededRandom } from '../helpers/strokes';

describe('resample', () => {
  it('UT-01 resamples 37 unevenly spaced points to 128 evenly spaced points', () => {
    // 37 points along half a circle, with random (uneven) gaps between them
    const rand = seededRandom(37);
    const gaps = Array.from({ length: 36 }, () => 0.5 + rand());
    const sum = gaps.reduce((a, b) => a + b, 0);
    const points: Point[] = [{ x: 550, y: 400, t: 0 }];
    let angle = 0;
    for (const g of gaps) {
      angle += (g / sum) * Math.PI;
      points.push({ x: 400 + 150 * Math.cos(angle), y: 400 + 150 * Math.sin(angle), t: angle * 100 });
    }

    const out = resample(points, 128);
    expect(out).toHaveLength(128);

    const spacing = out.slice(1).map((p, i) => Math.hypot(p.x - out[i].x, p.y - out[i].y));
    const avg = spacing.reduce((a, b) => a + b, 0) / spacing.length;
    for (const s of spacing) expect(Math.abs(s - avg) / avg).toBeLessThan(0.01);
  });

  it('UT-02 returns an empty stroke for a single point, without crashing', () => {
    expect(resample([{ x: 10, y: 10, t: 0 }])).toEqual([]);
  });
});

describe('capture', () => {
  it('UT-03 ignores a second point less than 2 px away', () => {
    const c = capture();
    expect(c.add({ x: 100, y: 100, t: 0 })).toBe(true);
    expect(c.add({ x: 101, y: 101, t: 16 })).toBe(false); // about 1.4 px away
    expect(c.points).toHaveLength(1);

    // The same rule when the points come from pointer events.
    // A stand-in for the canvas that can fire pointer events without a browser
    const el = new EventTarget() as unknown as HTMLElement;
    const fire = (type: string, x: number, y: number, pointerId = 1, t = 0) => {
      const e = Object.assign(new Event(type), { clientX: x, clientY: y, pointerId, button: 0 });
      Object.defineProperty(e, 'timeStamp', { value: t });
      el.dispatchEvent(e);
    };
    c.clear();
    let ended = 0;
    const detach = attachPointer(el, { onStart: (p) => c.add(p), onMove: (p) => c.add(p), onEnd: () => ended++ });
    fire('pointerdown', 100, 100);
    fire('pointerdown', 300, 300, 2);   // a second finger is ignored in single-pointer mode
    fire('pointermove', 101, 101, 1, 16); // 1.4 px away: ignored
    fire('pointermove', 110, 100, 1, 32);
    fire('pointerup', 110, 100);
    expect(c.points.map((p) => [p.x, p.y])).toEqual([[100, 100], [110, 100]]);
    expect(ended).toBe(1);
    detach();
    fire('pointerdown', 50, 50);
    expect(c.points).toHaveLength(2); // listeners removed
  });
});
