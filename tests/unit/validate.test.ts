// UT-15 to UT-21 (validation rules for a circle attempt)
import { describe, expect, it } from 'vitest';
import { validate } from '../../src/scoring/validate';
import { makeBacktrack, makeCircle } from '../helpers/strokes';

const centre = { cx: 400, cy: 400 };

describe('validate', () => {
  it('UT-15 rejects a stroke with a point 30 px from the dot: too_close', () => {
    const stroke = makeCircle({ cx: 400, cy: 400, r: 150, points: 128 });
    stroke[60] = { ...stroke[60], x: 430, y: 400 }; // 30 px right of the dot
    expect(validate(stroke, centre)).toEqual({ ok: false, reason: 'too_close' });
  });

  it('UT-16 rejects a stroke going back 0.50 rad: wrong_way', () => {
    const stroke = makeBacktrack({ cx: 400, cy: 400, r: 150, before: 2, back: 0.5, total: Math.PI * 2 });
    expect(validate(stroke, centre)).toEqual({ ok: false, reason: 'wrong_way' });
  });

  it('UT-17 accepts a stroke going back 0.40 rad (boundary)', () => {
    const stroke = makeBacktrack({ cx: 400, cy: 400, r: 150, before: 2, back: 0.4, total: Math.PI * 2 });
    expect(validate(stroke, centre)).toEqual({ ok: true });
  });

  it('UT-18 rejects a stroke covering 90% of a turn: not_closed', () => {
    const stroke = makeCircle({ cx: 400, cy: 400, r: 150, points: 128, turns: 0.9 });
    expect(validate(stroke, centre)).toEqual({ ok: false, reason: 'not_closed' });
  });

  it('UT-19 accepts a stroke covering exactly 93% of a turn (boundary)', () => {
    const stroke = makeCircle({ cx: 400, cy: 400, r: 150, points: 128, turns: 0.93 });
    expect(validate(stroke, centre)).toEqual({ ok: true });
  });

  it('UT-20 rejects a 10.1 s classic attempt and a 3.01 s attempt in 3 s timed mode: too_slow', () => {
    const classic = makeCircle({ cx: 400, cy: 400, r: 150, points: 128, durationMs: 10_100 });
    const timed = makeCircle({ cx: 400, cy: 400, r: 150, points: 128, durationMs: 3_010 });
    expect(validate(classic, centre)).toEqual({ ok: false, reason: 'too_slow' });
    expect(validate(timed, { ...centre, timeLimitMs: 3_000 })).toEqual({ ok: false, reason: 'too_slow' });
  });

  it('UT-21 rejects a stroke of 9 points: too_short', () => {
    const stroke = makeCircle({ cx: 400, cy: 400, r: 150, points: 9 });
    expect(validate(stroke, centre)).toEqual({ ok: false, reason: 'too_short' });
  });
});
