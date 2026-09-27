// Canvas drawing: the dot, the player's stroke, the dashed ideal shape and the timer ring.

import type { Point } from '../scoring/types';
import type { Ideal } from '../scoring';

type XY = { x: number; y: number };

/** Makes the canvas fill the window and stay sharp on high-resolution screens. */
export function fitCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = Math.round(width * dpr);   // real pixels
  canvas.height = Math.round(height * dpr);
  canvas.style.width = width + 'px';        // size on screen
  canvas.style.height = height + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);   // so we can keep drawing in screen pixels
  return { width, height };
}

export function drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, colour: string) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draws the ideal shape. The ideal's numbers are measured from the dot, so
 * (cx, cy) moves it to where the dot is on screen.
 */
export function drawIdeal(ctx: CanvasRenderingContext2D, ideal: Ideal, cx: number, cy: number, colour: string, dashed = true, width = 2) {
  ctx.save();
  if (dashed) ctx.setLineDash([6, 10]);
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = colour;
  ctx.beginPath();
  if (ideal.kind === 'circle') {
    ctx.arc(cx, cy, ideal.r, 0, Math.PI * 2);
  } else {
    ideal.points.forEach((p: XY, i) => (i === 0 ? ctx.moveTo(cx + p.x, cy + p.y) : ctx.lineTo(cx + p.x, cy + p.y)));
    ctx.closePath();
  }
  ctx.stroke();
  ctx.restore();
}

/** Draws the stroke one short segment at a time, each with its own colour. */
export function drawStroke(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  colourAt: (i: number) => string | null, // null = skip this segment (fully faded ink)
  width = 6,
  dx = 0,
  dy = 0,
) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = width;
  for (let i = 1; i < points.length; i++) {
    const colour = colourAt(i);
    if (colour === null) continue;
    ctx.strokeStyle = colour;
    ctx.beginPath();
    ctx.moveTo(points[i - 1].x + dx, points[i - 1].y + dy);
    ctx.lineTo(points[i].x + dx, points[i].y + dy);
    ctx.stroke();
  }
}

/** Timer ring around the dot: `fraction` = time left (1 = full, 0 = none). */
export function drawRing(ctx: CanvasRenderingContext2D, x: number, y: number, fraction: number, colour: string, track: string) {
  const r = 24;
  ctx.save();
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.strokeStyle = track;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  if (fraction > 0) {
    ctx.strokeStyle = colour;
    ctx.beginPath();
    ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + fraction * Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
