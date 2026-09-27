// Pointer capture: collects the points of a stroke from mouse, finger or stylus.
// capture() is plain logic (unit tested). attachPointer() connects it to the page.

import type { Point, Stroke } from '../scoring/types';

export const MIN_GAP_PX = 2; // points closer than this to the previous one are hand jitter

export interface Capture {
  points: Stroke;
  /** Adds a point. Returns false if it was ignored because it was too close. */
  add(p: Point): boolean;
  clear(): void;
}

export function capture(minGap = MIN_GAP_PX): Capture {
  const c: Capture = {
    points: [],
    add(p) {
      const prev = c.points[c.points.length - 1];
      if (prev && Math.hypot(p.x - prev.x, p.y - prev.y) < minGap) return false;
      c.points.push(p);
      return true;
    },
    clear() {
      c.points = [];
    },
  };
  return c;
}

export interface PointerHandlers {
  onStart(p: Point, pointerId: number): void;
  onMove(p: Point, pointerId: number): void;
  onEnd(pointerId: number): void;
}

/**
 * Listens for pointer events on an element (one code path for mouse, touch and pen).
 * multi = false: only the first finger draws. multi = true: every finger is reported
 * (used by split-screen duels). Point times are page times (performance.now()).
 * Returns a function that removes the listeners again.
 */
export function attachPointer(el: HTMLElement, h: PointerHandlers, multi = false): () => void {
  const active = new Set<number>(); // fingers/mouse currently drawing
  const toPoint = (e: PointerEvent): Point => ({ x: e.clientX, y: e.clientY, t: e.timeStamp });

  const down = (e: PointerEvent) => {
    if (e.button > 0 || (!multi && active.size > 0)) return; // left button / first finger only
    e.preventDefault();
    active.add(e.pointerId);
    try { el.setPointerCapture(e.pointerId); } catch { /* not supported */ }
    h.onStart(toPoint(e), e.pointerId);
  };

  const move = (e: PointerEvent) => {
    if (!active.has(e.pointerId)) return;
    e.preventDefault();
    // Browsers group fast movements; getCoalescedEvents gives every in-between point.
    const events = e.getCoalescedEvents?.() ?? [];
    for (const ev of events.length ? events : [e]) h.onMove(toPoint(ev), e.pointerId);
  };

  const up = (e: PointerEvent) => {
    if (!active.delete(e.pointerId)) return;
    h.onEnd(e.pointerId);
  };

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
  };
}
