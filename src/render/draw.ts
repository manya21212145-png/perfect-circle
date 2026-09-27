// Canvas drawing: the dot, the player's stroke and the dashed ideal shape.

import type { Point } from '../scoring/types';

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

/** The dashed "perfect" circle shown on the result. Other shapes come in step 5. */
export function drawIdeal(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, colour: string) {
  ctx.save();
  ctx.setLineDash([6, 10]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = colour;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Draws the stroke one short segment at a time, each with its own colour. */
export function drawStroke(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  colourAt: (i: number) => string,
  width = 6,
) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = width;
  for (let i = 1; i < points.length; i++) {
    ctx.strokeStyle = colourAt(i);
    ctx.beginPath();
    ctx.moveTo(points[i - 1].x, points[i - 1].y);
    ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  }
}
