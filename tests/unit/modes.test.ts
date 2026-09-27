// UT-22 to UT-25 (modes)
import { afterEach, describe, expect, it, vi } from 'vitest';
import { inkAlpha } from '../../src/modes/ink';
import { dotPosition, DOT_SPEED } from '../../src/modes/moving';
import { createTimer } from '../../src/modes/timed';
import { scoreAttempt } from '../../src/scoring';
import { resample } from '../../src/input/resample';
import type { Stroke } from '../../src/scoring/types';

describe('modes', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('UT-22 inkAlpha is 1, 0.5 and 0 at 0 s, 0.2 s and 0.4 s', () => {
    expect(inkAlpha(0)).toBe(1);
    expect(inkAlpha(200)).toBeCloseTo(0.5, 10);
    expect(inkAlpha(400)).toBe(0);
  });

  it('UT-23 dotPosition over 10 s gives the same positions twice, at 30 px/s within 5%', () => {
    const centre = { cx: 400, cy: 400 };
    const run = () => Array.from({ length: 201 }, (_, i) => dotPosition(i * 50, centre)); // every 50 ms
    const first = run();
    expect(run()).toEqual(first);
    let travelled = 0;
    for (let i = 1; i < first.length; i++) travelled += Math.hypot(first[i].x - first[i - 1].x, first[i].y - first[i - 1].y);
    const speed = travelled / 10; // px per second over 10 s
    expect(Math.abs(speed - DOT_SPEED) / DOT_SPEED).toBeLessThan(0.05);
  });

  it("UT-24 scores a perfect circle drawn around the moving dot's live position at 99% or more", () => {
    // The player's finger follows the dot: each point = dot position + a perfect circle offset.
    const raw: Stroke = [];
    for (let i = 0; i <= 300; i++) {
      const t = 500 + i * 10;                      // drawing starts 0.5 s into the round, lasts 3 s
      const a = (i / 300) * Math.PI * 2;
      const dot = dotPosition(t, { cx: 0, cy: 0 });
      raw.push({ x: dot.x + 150 * Math.cos(a), y: dot.y + 150 * Math.sin(a), t });
    }
    const result = scoreAttempt(resample(raw), { shape: 'circle', mode: 'moving' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.score).toBeGreaterThanOrEqual(99);
  });

  it('UT-25 a 3 s timer expires at 3000 ms, not before', () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    const timer = createTimer(3000, onExpire);
    timer.start();
    vi.advanceTimersByTime(2999);
    expect(onExpire).not.toHaveBeenCalled();
    expect(timer.expired).toBe(false);
    vi.advanceTimersByTime(1);
    expect(onExpire).toHaveBeenCalledOnce();
    expect(timer.remaining()).toBe(0);
  });
});
