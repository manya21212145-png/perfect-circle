// The drawing board used by Play, Daily, Duel and Split-screen.
//
// Board = one drawing area with its own dot (split-screen has two).
//   It runs the play loop: capture → live checks → finish → validate → score.
// Stage = the full-screen canvas. It owns the animation loop (60 frames a second),
//   sends each finger to the right Board, and draws every Board.

import { attachPointer, capture } from '../input/capture';
import { resample } from '../input/resample';
import { idealOutline } from '../scoring/polygon';
import { scoreAttempt, scoreShape, ORIGIN, type Ideal, type AttemptScore } from '../scoring';
import { distToOutline } from '../scoring/polygon';
import type { Point, Stroke } from '../scoring/types';
import { turnInfo, validate, type RejectReason } from '../scoring/validate';
import { timeLimitMs, type PlaySettings } from '../modes';
import { inkAlpha } from '../modes/ink';
import { dotPosition, relativeToDot } from '../modes/moving';
import { createTimer, type Timer } from '../modes/timed';
import { createTouchAssigner } from '../duel/split-screen';
import { errorColour, readPalette, rgba, type Palette } from '../render/colours';
import { drawDot, drawIdeal, drawRing, drawStroke, fitCanvas } from '../render/draw';

export const HINT_MS = 1000;           // the faint shape hint shows for 1 second
const LIVE_SCORE_EVERY_MS = 100;       // live score updates up to 10 times a second

export interface Region { x: number; y: number; w: number; h: number }

export type BoardResult =
  | { ok: false; reason: RejectReason; stroke128: Stroke; drawMs: number }
  | (Extract<AttemptScore, { ok: true }> & { stroke128: Stroke; drawMs: number });

export type Phase = 'locked' | 'idle' | 'drawing' | 'done' | 'failed';

export class Board {
  settings: PlaySettings;
  region: Region = { x: 0, y: 0, w: 0, h: 0 };
  phase: Phase = 'idle';
  label = '';
  /** Raw points in screen px; t = ms since this round started (t0). */
  private cap = capture();
  private t0 = 0;
  /** false in duels: a finished attempt cannot be redrawn by tapping again. */
  retryOnTap = true;
  private hintUntil = 0;
  private timer: Timer | null = null;
  private lastLive = 0;
  private live: { ideal: Ideal; R: number } | null = null;
  result: BoardResult | null = null;
  liveScore: number | null = null;

  onFinish?: (r: BoardResult) => void;
  onLive?: (score: number | null) => void;
  onProgress?: (fraction: number) => void;
  onStartDrawing?: () => void;

  constructor(settings: PlaySettings) {
    this.settings = settings;
  }

  get centre() {
    return { cx: this.region.x + this.region.w / 2, cy: this.region.y + this.region.h / 2 };
  }

  get points(): Point[] { return this.cap.points; }
  /** Page time this round started. */
  get roundStart() { return this.t0; }

  /** New attempt. startAt = page time the round starts (the moving dot starts there). */
  reset(startAt = performance.now(), locked = false) {
    this.cap.clear();
    this.timer?.cancel();
    this.timer = null;
    this.t0 = startAt;
    this.hintUntil = startAt + HINT_MS;
    this.phase = locked ? 'locked' : 'idle';
    this.result = null;
    this.live = null;
    this.liveScore = null;
    this.onLive?.(null);
  }

  unlock() { if (this.phase === 'locked') this.phase = 'idle'; }
  lock() { if (this.phase === 'idle') this.phase = 'locked'; }

  /** The dot's current position on screen (it moves in moving-dot mode). */
  dotAt(now: number) {
    if (this.settings.mode !== 'moving' || this.phase === 'done') return { x: this.centre.cx, y: this.centre.cy };
    return dotPosition(Math.max(0, now - this.t0), this.centre);
  }

  /** Stroke measured from the dot's resting place, as the scoring module wants it. */
  private relative(): Stroke {
    const { cx, cy } = this.centre;
    return this.cap.points.map((p) => ({ x: p.x - cx, y: p.y - cy, t: p.t }));
  }
  private placed(rel = this.relative()): Stroke {
    return this.settings.mode === 'moving' ? relativeToDot(rel, ORIGIN) : rel;
  }

  // ---- pointer input (page time) ----
  pointerDown(p: Point) {
    if (this.phase === 'locked') return;
    if (this.phase === 'done' || this.phase === 'failed') {
      if (!this.retryOnTap) return;
      this.reset(); // tap again = retry
    }
    if (p.t < this.hintUntil) this.hintUntil = p.t;                     // hide the hint
    this.phase = 'drawing';
    if (this.settings.mode === 'timed') {
      this.timer = createTimer(timeLimitMs(this.settings), () => this.fail('too_slow'));
      this.timer.start();
    }
    this.onStartDrawing?.();
    this.pointerMove(p);
  }

  pointerMove(p: Point) {
    if (this.phase !== 'drawing') return;
    if (!this.cap.add({ x: p.x, y: p.y, t: p.t - this.t0 })) return;
    const placed = this.placed();

    // Rules that can fail while still drawing: too close, too slow, wrong way
    const check = validate(placed, { ...ORIGIN, timeLimitMs: timeLimitMs(this.settings), complete: false });
    if (!check.ok) return this.fail(check.reason);

    const { turned } = turnInfo(placed, ORIGIN);
    this.onProgress?.(Math.min(1, turned / (Math.PI * 2)));

    if (placed.length > 8 && turned > 0.6 && p.t - this.lastLive > LIVE_SCORE_EVERY_MS) {
      this.lastLive = p.t;
      const s = scoreShape(resample(placed), this.settings.shape, ORIGIN);
      this.live = { ideal: s.ideal, R: s.R };
      this.liveScore = Math.round(s.score * 10) / 10;
      this.onLive?.(this.liveScore);
    }
    if (turned >= Math.PI * 2) this.finish(); // a full turn ends the attempt
  }

  pointerUp() {
    if (this.phase === 'drawing') this.finish();
  }

  private fail(reason: RejectReason) {
    if (this.phase !== 'drawing') return;
    this.timer?.cancel();
    this.phase = 'failed';
    const pts = this.cap.points;
    const r: BoardResult = {
      ok: false, reason, stroke128: resample(this.relative()),
      drawMs: pts.length ? pts[pts.length - 1].t - pts[0].t : 0,
    };
    this.result = r;
    this.onLive?.(null);
    this.onFinish?.(r);
  }

  finish() {
    if (this.phase !== 'drawing') return;
    this.timer?.cancel();
    const rel = this.relative();
    // Check the raw stroke first (a 9-point stroke is too short even after resampling)
    const raw = validate(this.placed(rel), { ...ORIGIN, timeLimitMs: timeLimitMs(this.settings) });
    if (!raw.ok) return this.fail(raw.reason);

    const stroke128 = resample(rel);
    const scored = scoreAttempt(stroke128, this.settings);
    if (!scored.ok) return this.fail(scored.reason);
    this.phase = 'done';
    const drawMs = rel[rel.length - 1].t - rel[0].t;
    this.result = { ...scored, stroke128, drawMs };
    this.onLive?.(scored.score);
    this.onFinish?.(this.result);
  }

  /** How far a point (measured from the resting dot) is from the live ideal shape. */
  private liveError(p: { x: number; y: number }): number {
    if (!this.live || this.live.R <= 0) return 0;
    if (this.live.ideal.kind === 'circle') return Math.abs(Math.hypot(p.x, p.y) - this.live.ideal.r) / this.live.R;
    return distToOutline(p, this.live.ideal.points) / this.live.R;
  }

  // ---- drawing ----
  render(ctx: CanvasRenderingContext2D, pal: Palette, now: number) {
    const { cx, cy } = this.centre;
    const size = 0.34 * Math.min(this.region.w, this.region.h);

    // faint shape hint for the first second of a round
    if ((this.phase === 'idle' || this.phase === 'locked') && now < this.hintUntil + 300) {
      const fade = now < this.hintUntil ? 1 : 1 - (now - this.hintUntil) / 300;
      const hint: Ideal = this.settings.shape === 'circle'
        ? { kind: 'circle', r: size }
        : { kind: 'polygon', points: idealOutline(this.settings.shape, ORIGIN, size) };
      drawIdeal(ctx, hint, cx, cy, rgba(pal.muted, 0.35 * fade), false, 3);
    }

    const r = this.result;
    if (this.phase === 'done' && r && r.ok) {
      // Result: the scored stroke (full, even in ink mode) and the ideal shape on top
      drawStroke(ctx, r.scored, (i) => rgba(errorColour(r.errors[i], pal)), 6, cx, cy);
      drawIdeal(ctx, r.ideal, cx, cy, rgba(pal.ink, 0.55));
    } else if (this.cap.points.length > 1) {
      const pts = this.cap.points;
      const placed = this.placed();
      const ink = this.settings.mode === 'ink' && this.phase === 'drawing';
      drawStroke(ctx, pts, (i) => {
        if (this.phase === 'failed') return rgba(pal.muted, 0.8);
        const alpha = ink ? inkAlpha(now - this.t0 - pts[i].t) : 1;
        if (alpha <= 0) return null;
        return rgba(errorColour(this.liveError(placed[i]), pal), alpha);
      });
    }

    const dot = this.dotAt(now);
    if (this.settings.mode === 'timed' && this.phase !== 'done') {
      const left = this.timer ? this.timer.remaining() / timeLimitMs(this.settings) : this.phase === 'failed' ? 0 : 1;
      drawRing(ctx, dot.x, dot.y, left, rgba(left > 0.3 ? pal.good : pal.bad), rgba(pal.muted, 0.25));
    }
    drawDot(ctx, dot.x, dot.y, rgba(pal.ink));
  }
}

/** Splits the screen: one board = full screen; two boards = left and right halves. */
export function layoutBoards(boards: Board[], width: number, height: number, top = 0) {
  const n = boards.length;
  boards.forEach((b, i) => {
    b.region = { x: (i * width) / n, y: top, w: width / n, h: height - top };
  });
}

export class Stage {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  boards: Board[] = [];
  width = 0;
  height = 0;
  top = 0;               // space kept free at the top (duel progress bars)
  palette: Palette = readPalette();
  /** Only this board takes input (turn-by-turn split-screen). null = all boards. */
  activeBoard: Board | null = null;
  onResize?: () => void;
  private raf = 0;
  private detach: (() => void) | null = null;
  private touches = createTouchAssigner();
  private owners = new Map<number, Board>();
  private themeQuery = window.matchMedia('(prefers-color-scheme: dark)');

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  private resize = () => {
    ({ width: this.width, height: this.height } = fitCanvas(this.canvas, this.ctx));
    layoutBoards(this.boards, this.width, this.height, this.top);
    for (const b of this.boards) if (b.phase === 'drawing') b.reset(b.roundStart); // the dot moved: start again
    this.onResize?.();
  };

  private themeChanged = () => { this.palette = readPalette(); };

  start(boards: Board[]) {
    this.stop();
    this.boards = boards;
    this.canvas.hidden = false;
    this.palette = readPalette();
    this.resize();
    window.addEventListener('resize', this.resize);
    this.themeQuery.addEventListener('change', this.themeChanged);

    this.detach = attachPointer(this.canvas, {
      onStart: (p, id) => {
        const b = this.boards.length === 1
          ? this.boards[0]
          : this.boards[this.touches.start(id, p.x, this.width) - 1];
        if (!b || (this.activeBoard && b !== this.activeBoard)) return;
        this.owners.set(id, b);
        b.pointerDown(p);
      },
      onMove: (p, id) => this.owners.get(id)?.pointerMove(p),
      onEnd: (id) => {
        this.owners.get(id)?.pointerUp();
        this.owners.delete(id);
        this.touches.end(id);
      },
    }, boards.length > 1);

    const frame = (now: number) => {
      const { ctx } = this;
      ctx.clearRect(0, 0, this.width, this.height);
      if (this.boards.length > 1) {         // divider between split-screen halves
        ctx.fillStyle = rgba(this.palette.muted, 0.35);
        ctx.fillRect(this.width / 2 - 1, this.top, 2, this.height - this.top);
      }
      for (const b of this.boards) b.render(ctx, this.palette, now);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  /** Re-reads colours (after a theme change in Settings). */
  refreshPalette() { this.palette = readPalette(); }

  setTop(px: number) { this.top = px; this.resize(); }

  stop() {
    cancelAnimationFrame(this.raf);
    this.detach?.();
    this.detach = null;
    window.removeEventListener('resize', this.resize);
    this.themeQuery.removeEventListener('change', this.themeChanged);
    this.owners.clear();
    this.boards = [];
    this.top = 0;
    this.activeBoard = null;
    this.canvas.hidden = true;
  }
}
