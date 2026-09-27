// Validation rules from the Functional Design ("Validation rules" table).
// validate() looks at a stroke and says whether it is allowed to be scored.

import type { Centre, Stroke } from './types';

export const MIN_POINTS = 10;              // "Too short": fewer than 10 points
export const MIN_RADIUS = 45;              // "Too close": any point within 45 px of the dot
export const BACKTRACK_LIMIT = 0.45;       // "Wrong direction": going back more than 0.45 rad
export const CLOSE_ENOUGH = 0.93;          // "Not closed": less than 93% of a full turn
export const CLASSIC_TIME_LIMIT_MS = 10_000; // "Too slow": longer than 10 s in classic mode

const FULL_TURN = Math.PI * 2;
const TINY = 1e-9; // lets a stroke of *exactly* 93% pass despite rounding errors

export type RejectReason = 'too_short' | 'too_close' | 'too_slow' | 'wrong_way' | 'not_closed';

export type ValidationResult = { ok: true } | { ok: false; reason: RejectReason };

export interface ValidateOptions extends Centre {
  /** Time limit for this attempt in ms. Classic mode uses 10 s. */
  timeLimitMs?: number;
  /**
   * true (default) = the player has finished, so check every rule.
   * false = the player is still drawing, so skip "too short" and "not closed".
   */
  complete?: boolean;
}

/**
 * Follows the stroke around the dot and measures:
 *  - turned:    how far around the dot it went (radians, 2π = one full turn)
 *  - backtrack: the biggest amount it ever went backwards (radians)
 */
export function turnInfo(stroke: Stroke, centre: Centre): { turned: number; backtrack: number } {
  let total = 0;        // signed angle travelled (clockwise and anticlockwise cancel out)
  let furthest = 0;     // the furthest we have ever been from the start
  let backtrack = 0;

  for (let i = 1; i < stroke.length; i++) {
    const a0 = Math.atan2(stroke[i - 1].y - centre.cy, stroke[i - 1].x - centre.cx);
    const a1 = Math.atan2(stroke[i].y - centre.cy, stroke[i].x - centre.cx);
    let step = a1 - a0;
    // atan2 jumps from +π to -π; fix that so each step is the short way round
    if (step > Math.PI) step -= FULL_TURN;
    if (step < -Math.PI) step += FULL_TURN;

    total += step;
    furthest = Math.max(furthest, Math.abs(total));
    backtrack = Math.max(backtrack, furthest - Math.abs(total));
  }
  return { turned: Math.abs(total), backtrack };
}

/** Checks a stroke against the rules. Returns { ok: true } or the reason it failed. */
export function validate(stroke: Stroke, opts: ValidateOptions): ValidationResult {
  const complete = opts.complete ?? true;
  const limit = opts.timeLimitMs ?? CLASSIC_TIME_LIMIT_MS;

  if (complete && stroke.length < MIN_POINTS) return { ok: false, reason: 'too_short' };

  for (const p of stroke) {
    if (Math.hypot(p.x - opts.cx, p.y - opts.cy) < MIN_RADIUS) {
      return { ok: false, reason: 'too_close' };
    }
  }

  if (stroke.length > 1 && stroke[stroke.length - 1].t - stroke[0].t > limit) {
    return { ok: false, reason: 'too_slow' };
  }

  const { turned, backtrack } = turnInfo(stroke, opts);
  if (backtrack > BACKTRACK_LIMIT) return { ok: false, reason: 'wrong_way' };
  if (complete && turned < CLOSE_ENOUGH * FULL_TURN - TINY) return { ok: false, reason: 'not_closed' };

  return { ok: true };
}
