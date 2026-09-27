// Helpers for end-to-end tests: draw shapes with the mouse, the way a player would.
import type { Page } from '@playwright/test';
import { template } from '../../src/scoring/templates';

type Shape = 'circle' | 'square' | 'triangle' | 'star';

/** Points along a shape's outline, ending where it started. */
export function outline(shape: Shape, cx: number, cy: number, size: number, steps = 90, turns = 1): { x: number; y: number }[] {
  if (shape === 'circle') {
    return Array.from({ length: steps + 1 }, (_, i) => {
      const a = (i / steps) * Math.PI * 2 * turns;
      return { x: cx + size * Math.cos(a), y: cy + size * Math.sin(a) };
    });
  }
  const v = template(shape).vertices.map((p) => ({ x: cx + p.x * size, y: cy + p.y * size }));
  v.push(v[0]);
  const per = Math.ceil(steps / (v.length - 1));
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < v.length - 1; i++) {
    for (let k = 0; k < per; k++) {
      const f = k / per;
      pts.push({ x: v[i].x + (v[i + 1].x - v[i].x) * f, y: v[i].y + (v[i + 1].y - v[i].y) * f });
    }
  }
  pts.push(v[v.length - 1]);
  return pts;
}

/** Presses, moves through the points, and lets go. */
export async function drawPath(page: Page, pts: { x: number; y: number }[], pauseMs = 0) {
  await page.mouse.move(pts[0].x, pts[0].y);
  await page.mouse.down();
  for (const p of pts.slice(1)) await page.mouse.move(p.x, p.y);
  if (pauseMs) await page.waitForTimeout(pauseMs);
  await page.mouse.up();
}

/** Centre of the screen (where the dot is on the Play screen). */
export function centre(page: Page) {
  const vp = page.viewportSize()!;
  return { cx: vp.width / 2, cy: vp.height / 2, size: Math.min(vp.width, vp.height) * 0.3 };
}

export async function drawShape(page: Page, shape: Shape, opts: { steps?: number; scale?: number; top?: number; cx?: number } = {}) {
  const vp = page.viewportSize()!;
  const top = opts.top ?? 0;
  const cx = opts.cx ?? vp.width / 2;
  const cy = top + (vp.height - top) / 2;
  const size = Math.min(vp.width, vp.height - top) * 0.3 * (opts.scale ?? 1);
  await drawPath(page, outline(shape, cx, cy, size, opts.steps ?? 90));
}

/** Waits past the 1-second shape hint so the board is ready. */
export const settle = (page: Page) => page.waitForTimeout(300);
