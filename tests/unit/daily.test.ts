// UT-26 to UT-30 (daily challenge and share text)
import { describe, expect, it } from 'vitest';
import { addDays, dailyChallenge } from '../../src/daily/seed';
import { GREEN, RED, YELLOW, shareText, squareFor } from '../../src/daily/share';
import { SHAPES } from '../../src/scoring/templates';
import { MODES } from '../../src/modes';

describe('daily', () => {
  it('UT-26 dailyChallenge for 2026-10-01 gives the same shape and mode 3 times', () => {
    const a = dailyChallenge('2026-10-01');
    expect(dailyChallenge('2026-10-01')).toEqual(a);
    expect(dailyChallenge(new Date('2026-10-01T15:00:00Z'))).toEqual(a);
  });

  it('UT-27 over 365 days all 4 shapes and all modes appear', () => {
    const shapes = new Set<string>();
    const modes = new Set<string>();
    for (let i = 0; i < 365; i++) {
      const c = dailyChallenge(addDays('2026-10-01', i));
      shapes.add(c.shape);
      modes.add(c.mode);
    }
    expect([...shapes].sort()).toEqual([...SHAPES].sort());
    expect([...modes].sort()).toEqual([...MODES].sort());
  });

  it('UT-28 23:59:59 UTC and 00:00:00 UTC the next day (05:29:59 / 05:30:00 IST) are different challenges', () => {
    const before = dailyChallenge(new Date('2026-10-01T23:59:59Z'));
    const after = dailyChallenge(new Date('2026-10-02T00:00:00Z'));
    expect(before.date).toBe('2026-10-01');
    expect(after.date).toBe('2026-10-02');
    expect(after.number).toBe(before.number + 1);
    expect(after).not.toEqual(before);
    // The same moments written in India Standard Time
    expect(dailyChallenge(new Date('2026-10-02T05:29:59+05:30'))).toEqual(before);
    expect(dailyChallenge(new Date('2026-10-02T05:30:00+05:30'))).toEqual(after);
  });

  it('UT-29 shareText for challenge 42, score 91.84 contains "#42", "91.8%" and exactly 5 squares', () => {
    const text = shareText({ number: 42, shape: 'star', mode: 'ink', score: 91.84, errors: [0.01, 0.02, 0.02, 0.05, 0.01], streak: 12 });
    expect(text).toContain('#42');
    expect(text).toContain('91.8%');
    const squares = text.match(/🟩|🟨|🟥/gu) ?? [];
    expect(squares).toHaveLength(5);
    expect(text).toBe('Perfect Circle #42  Star, disappearing ink\n91.8%  🟩🟩🟩🟨🟩\nStreak: 12 days');
  });

  it('UT-30 segment errors of 2%, 5% and 8% are green, yellow and red', () => {
    expect([0.02, 0.05, 0.08].map(squareFor)).toEqual([GREEN, YELLOW, RED]);
  });
});
