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
  onStart(p: Point): void;
  onMove(p: Point): void;
  onEnd(): void;
}

/**
 * Listens for pointer events on an element (one code path for mouse, touch and pen).
 * Returns a function that removes the listeners again.
 */
export function attachPointer(el: HTMLElement, h: PointerHandlers): () => void {
  let active: number | null = null; // id of the finger/mouse currently drawing
  const toPoint = (e: PointerEvent): Point => ({ x: e.clientX, y: e.clientY, t: e.timeStamp });

  const down = (e: PointerEvent) => {
    if (e.button > 0 || active !== null) return; // left button / first finger only
    e.preventDefault();
    active = e.pointerId;
    try { el.setPointerCapture(e.pointerId); } catch { /* not supported */ }
    h.onStart(toPoint(e));
  };

  const move = (e: PointerEvent) => {
    if (e.pointerId !== active) return;
    e.preventDefault();
    // Browsers group fast movements; getCoalescedEvents gives every in-between point.
    const events = e.getCoalescedEvents?.() ?? [];
    for (const ev of events.length ? events : [e]) h.onMove(toPoint(ev));
  };

  const up = (e: PointerEvent) => {
    if (e.pointerId !== active) return;
    active = null;
    h.onEnd();
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
