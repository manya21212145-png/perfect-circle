// UT-31 to UT-38 (streaks, badges, history graph)
import { describe, expect, it } from 'vitest';
import { EMPTY_STREAK, currentStreak, streakFromDates, updateStreak } from '../../src/progression/streak';
import { checkBadges, type BadgeAttempt } from '../../src/progression/badges';
import { historySeries, type HistoryAttempt } from '../../src/progression/history';

const ctx = { bestStreak: 0, duelWins: 0 };
const att = (score: number, extra: Partial<BadgeAttempt> = {}): BadgeAttempt =>
  ({ shape: 'circle', mode: 'classic', off_hand: false, score, ...extra });

describe('streak', () => {
  it('UT-31 dailies on 3 consecutive days give a streak of 3', () => {
    const s = streakFromDates(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(s.current).toBe(3);
    expect(currentStreak(s, '2026-10-03')).toBe(3);
  });

  it('UT-32 streak 5, then a missed day, then a daily gives streak 1; best stays 5', () => {
    const five = streakFromDates(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']);
    expect(currentStreak(five, '2026-10-07')).toBe(0); // missed 10-06: shown as 0
    const after = updateStreak(five, '2026-10-07');
    expect(after.current).toBe(1);
    expect(after.best).toBe(5);
  });

  it('UT-33 two dailies on the same UTC day raise the streak by 1 only', () => {
    const one = updateStreak(EMPTY_STREAK, '2026-10-01');
    const again = updateStreak(one, '2026-10-01');
    expect(again.current).toBe(1);
    expect(streakFromDates(['2026-10-01', '2026-10-01']).current).toBe(1);
  });
});

describe('badges', () => {
  it('UT-34 gives Sharp eye for 90.0% but not for 89.9%', () => {
    expect(checkBadges([att(89.9)], [], ctx)).not.toContain('sharp_eye');
    expect(checkBadges([att(90.0)], [], ctx)).toContain('sharp_eye');
  });

  it('UT-35 awards Nearly perfect once for two scores above 95%', () => {
    const first = checkBadges([att(96)], [], ctx);
    expect(first.filter((b) => b === 'nearly_perfect')).toHaveLength(1);
    const second = checkBadges([att(96), att(97)], first, ctx);
    expect(second).not.toContain('nearly_perfect');
  });

  it('UT-36 does not award Shape master for 85%+ on 3 shapes and 84% on the 4th', () => {
    const list = [att(90, { shape: 'circle' }), att(86, { shape: 'square' }), att(85, { shape: 'triangle' }), att(84, { shape: 'star' })];
    expect(checkBadges(list, [], ctx)).not.toContain('shape_master');
    expect(checkBadges([...list, att(85, { shape: 'star' })], [], ctx)).toContain('shape_master');
  });
});

describe('historySeries', () => {
  // 10-day fixture: day i (1..10) of October 2026 has two attempts, scores 60+i and 70+i.
  const day = (d: number, h: number) => Date.parse(`2026-10-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00Z`);
  const fixture: HistoryAttempt[] = [];
  for (let d = 1; d <= 10; d++) {
    fixture.push({ shape: 'circle', mode: 'classic', off_hand: d % 2 === 0, score: 60 + d, created_at: day(d, 9) });
    fixture.push({ shape: 'circle', mode: 'classic', off_hand: false, score: 70 + d, created_at: day(d, 18) });
  }

  it('UT-37 daily best and 7-day average match hand-calculated values', () => {
    const s = historySeries(fixture);
    expect(s.points).toHaveLength(20);
    expect(s.days.map((d) => d.best)).toEqual([71, 72, 73, 74, 75, 76, 77, 78, 79, 80]);
    // day 1: only 71 → 71; day 3: (71+72+73)/3 = 72; day 7: (71..77)/7 = 74; day 10: (74..80)/7 = 77
    expect(s.days[0].avg7).toBe(71);
    expect(s.days[2].avg7).toBe(72);
    expect(s.days[6].avg7).toBe(74);
    expect(s.days[9].avg7).toBe(77);
  });

  it('UT-38 with the off-hand filter on, only off_hand attempts are returned', () => {
    const s = historySeries(fixture, { offHandOnly: true });
    expect(s.points).toHaveLength(5);
    expect(s.points.map((p) => p.score)).toEqual([62, 64, 66, 68, 70]);
  });
});
