// The Play screen: joins input -> validate -> score -> render into one game loop.
// For now it is the classic circle game from perfect-circle.html. Shapes, modes and
// the Setup screen come in steps 5 and 6.

import { attachPointer, capture } from '../input/capture';
import { resample } from '../input/resample';
import { meanRadius, pointErrors, scoreCircle } from '../scoring/circle';
import type { Point } from '../scoring/types';
import { turnInfo, validate, type RejectReason } from '../scoring/validate';
import { errorColour, readPalette, rgba, type Palette } from '../render/colours';
import { drawDot, drawIdeal, drawStroke, fitCanvas } from '../render/draw';

// Messages from the Functional Design's "Validation rules" table.
const MESSAGES: Record<RejectReason, string> = {
  too_close: 'Too close to the dot. Try again.',
  wrong_way: 'Wrong way. Keep going in one direction.',
  not_closed: 'Close the shape. Try again.',
  too_slow: 'Too slow. Try again.',
  too_short: 'Draw a bigger shape.',
};

const BEST_KEY = 'perfect-circle-best'; // moves to IndexedDB in step 7

function verdict(s: number): string {
  if (s >= 97) return 'Basically a compass';
  if (s >= 93) return 'Nearly perfect';
  if (s >= 88) return 'Excellent';
  if (s >= 80) return 'Pretty round';
  if (s >= 65) return "Wobbly, but it's a circle";
  return "That's more of a potato";
}

export function startPlay(): void {
  const canvas = document.getElementById('board') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  const scoreEl = document.getElementById('score')!;
  const noteEl = document.getElementById('note')!;
  const bestEl = document.getElementById('best')!;
  const shareBtn = document.getElementById('share') as HTMLButtonElement;

  const cap = capture();
  let phase: 'idle' | 'drawing' | 'done' | 'failed' = 'idle';
  let width = 0;
  let height = 0;
  let centre = { cx: 0, cy: 0 };
  let palette: Palette = readPalette();
  let lastScore: number | null = null;

  // ---- best score on this device ----
  let best: number | null = null;
  try {
    const saved = localStorage.getItem(BEST_KEY);
    if (saved !== null && !isNaN(parseFloat(saved))) best = parseFloat(saved);
  } catch { /* storage not available */ }
  const showBest = () => { bestEl.textContent = best === null ? '' : `Best ${best.toFixed(1)}%`; };
  showBest();

  const setNote = (text: string, dim = false) => {
    noteEl.textContent = text;
    noteEl.classList.toggle('dim', dim);
  };

  // ---- drawing the screen ----
  function render() {
    ctx.clearRect(0, 0, width, height);
    const pts = cap.points;

    if (phase === 'done') {
      drawIdeal(ctx, centre.cx, centre.cy, meanRadius(resample(pts), centre), rgba(palette.muted, 0.7));
    }
    if (pts.length > 1) {
      const errors = pointErrors(pts, centre);
      drawStroke(ctx, pts, (i) =>
        phase === 'failed' ? rgba(palette.muted, 0.8) : rgba(errorColour(errors[i], palette)));
    }
    drawDot(ctx, centre.cx, centre.cy, rgba(palette.ink));
  }

  // ---- game steps ----
  function reset() {
    cap.clear();
    phase = 'idle';
    lastScore = null;
    scoreEl.textContent = '';
    shareBtn.hidden = true;
  }

  function fail(reason: RejectReason) {
    phase = 'failed';
    scoreEl.textContent = '';
    setNote(MESSAGES[reason]);
    render();
  }

  function finish() {
    if (phase !== 'drawing') return;
    const check = validate(cap.points, centre); // all rules, including "too short" and "not closed"
    if (!check.ok) { fail(check.reason); return; }

    phase = 'done';
    const s = scoreCircle(resample(cap.points), centre);
    lastScore = s;
    scoreEl.textContent = s.toFixed(1) + '%';
    if (best === null || s > best) {
      best = s;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* ignore */ }
      showBest();
      setNote(verdict(s) + '. New best!');
    } else {
      setNote(verdict(s));
    }
    shareBtn.hidden = false;
    render();
  }

  function addPoint(p: Point) {
    if (phase !== 'drawing' || !cap.add(p)) return;

    // Rules that can fail while still drawing: too close, too slow, wrong way
    const check = validate(cap.points, { ...centre, complete: false });
    if (!check.ok) { fail(check.reason); return; }

    const { turned } = turnInfo(cap.points, centre);
    if (cap.points.length > 8 && turned > 0.6) {
      scoreEl.textContent = scoreCircle(resample(cap.points), centre).toFixed(1) + '%'; // live score
    }
    if (turned >= Math.PI * 2) finish(); // a full turn ends the attempt automatically
  }

  attachPointer(canvas, {
    onStart(p) {
      reset();
      phase = 'drawing';
      setNote('', true);
      addPoint(p);
      render();
    },
    onMove(p) {
      addPoint(p);
      render();
    },
    onEnd() {
      finish();
    },
  });

  // ---- share button ----
  shareBtn.addEventListener('click', async () => {
    if (lastScore === null) return;
    const text = `I drew a ${lastScore.toFixed(1)}% perfect circle. Can you beat it?`;
    try {
      if (navigator.share) { await navigator.share({ text, url: location.href }); return; }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(text + ' ' + location.href);
      shareBtn.textContent = 'Copied';
      setTimeout(() => { shareBtn.textContent = 'Share score'; }, 1600);
    } catch {
      shareBtn.hidden = true;
    }
  });

  // ---- window size and theme ----
  function resize() {
    ({ width, height } = fitCanvas(canvas, ctx));
    centre = { cx: width / 2, cy: height / 2 };
    if (phase === 'drawing') reset(); // the dot moved, so the stroke no longer counts
    render();
  }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    palette = readPalette();
    render();
  });
  window.addEventListener('resize', resize);
  resize();
  document.fonts?.ready.then(render);
}
