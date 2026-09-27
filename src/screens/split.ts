// Split-screen duel on one device. Left half = Player 1, right half = Player 2.
// On a touch screen both draw at once; with one mouse they take turns on the same shape.
// Best of 3 rounds.

import { backButton, h, navButton, REASONS, type Screen } from './ui';
import { Board, type BoardResult } from './board';
import { getStage } from './play';
import { SHAPES, SHAPE_NAMES } from '../scoring/templates';
import { MODES, modeName, type PlaySettings } from '../modes';
import { TIME_LIMITS_S } from '../modes/timed';
import { newMatch, recordRound, type Match } from '../duel/match';
import { playSound } from '../render/sound';
import { getSettings } from '../state';

const COUNTDOWN_MS = 3000;
const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

function randomSettings(): PlaySettings {
  const mode = pick(MODES);
  return { shape: pick(SHAPES), mode, limitS: mode === 'timed' ? pick(TIME_LIMITS_S) : undefined, offHand: false };
}

export const splitScreen: Screen = (root) => {
  const touch = navigator.maxTouchPoints > 0;
  let turns = !touch;               // FR-14: one mouse → turn by turn
  let match: Match = newMatch();
  let boards: Board[] = [];
  let results: (BoardResult | null)[] = [null, null];
  let timer = 0;
  const caps: number[] = [];

  /** If a player has not drawn anything 10 s after their start, their round counts as 0. */
  function capBoard(i: number) {
    caps.push(window.setTimeout(() => {
      const b = boards[i];
      if (results[i] || b.phase !== 'idle') return;
      b.lock();
      b.onFinish?.({ ok: false, reason: 'too_slow', stroke128: [], drawMs: Infinity });
    }, 10_000));
  }

  const stage = getStage();
  const labels = [h('div', { class: 'split-label left' }), h('div', { class: 'split-label right' })];
  const big = h('div', { class: 'countdown', 'aria-live': 'assertive' });
  const sheet = h('section', { class: 'sheet', hidden: true, 'aria-live': 'polite' });
  const modeBtn = h('button', { class: 'btn ghost small', type: 'button', onclick: () => {
    turns = !turns;
    modeBtn.textContent = turns ? 'Take turns' : 'Draw together';
  } }, turns ? 'Take turns' : 'Draw together');

  root.append(
    h('header', { class: 'topbar overlay' },
      backButton('#/home'),
      h('h1', {}, 'Split-screen duel'),
      modeBtn),
    ...labels, big, sheet);

  const wins = () => `Player 1: ${match.wins[0]} · Player 2: ${match.wins[1]}`;
  const setLabel = (i: number, extra = '') => { labels[i].textContent = `Player ${i + 1}${extra}`; };

  /** 3-2-1 on screen, then calls go(). */
  function countdown(text: string, go: () => void) {
    clearInterval(timer);
    const end = performance.now() + COUNTDOWN_MS;
    let last = '';
    timer = window.setInterval(() => {
      const left = end - performance.now();
      const n = left > 0 ? String(Math.ceil(left / 1000)) : 'Draw!';
      if (n !== last) { last = n; big.textContent = `${text}\n${n}`; playSound('tick', getSettings().sound); }
      if (left <= 0) {
        clearInterval(timer);
        go();
        setTimeout(() => { if (big.textContent?.endsWith('Draw!')) big.textContent = ''; }, 700);
      }
    }, 50);
  }

  function newRound() {
    sheet.hidden = true;
    caps.forEach(clearTimeout);
    caps.length = 0;
    results = [null, null];
    const settings = randomSettings();
    boards = [new Board({ ...settings }), new Board({ ...settings })];
    boards.forEach((b, i) => {
      b.retryOnTap = false;
      setLabel(i);
      b.onFinish = (r) => {
        results[i] = r;
        setLabel(i, r.ok ? ` — ${r.score.toFixed(1)}%` : ` — ${REASONS[r.reason]}`);
        playSound(r.ok ? 'good' : 'bad', getSettings().sound);
        if (turns && i === 0) {             // Player 2's turn on the same shape
          stage.activeBoard = boards[1];
          countdown("Player 2's turn", () => { boards[1].reset(performance.now()); capBoard(1); });
        }
        if (results[0] && results[1]) finishRound();
      };
    });
    stage.start(boards);
    const title = `${SHAPE_NAMES[settings.shape]} · ${modeName(settings)}`;
    boards.forEach((b) => b.reset(performance.now() + COUNTDOWN_MS, true));
    if (turns) {
      stage.activeBoard = boards[0];
      countdown(`Round ${match.rounds.length + 1}: ${title}\nPlayer 1 first`, () => { boards[0].unlock(); capBoard(0); });
    } else {
      countdown(`Round ${match.rounds.length + 1}: ${title}`, () => { boards.forEach((b) => b.unlock()); capBoard(0); capBoard(1); });
    }
  }

  function finishRound() {
    const entry = (r: BoardResult | null) => ({ score: r && r.ok ? r.score : 0, finishMs: r ? r.drawMs : Infinity });
    match = recordRound(match, entry(results[0]), entry(results[1]));
    const w = match.rounds[match.rounds.length - 1];
    const tie = entry(results[0]).score === entry(results[1]).score;
    const done = match.winner !== null;
    sheet.replaceChildren(
      h('h2', {}, done ? `Player ${match.winner} wins the duel! 🏆` : `Player ${w} wins round ${match.rounds.length}`),
      tie ? h('p', { class: 'muted small' }, 'Same score — the faster finish wins.') : '',
      h('p', { class: 'muted' }, wins()),
      h('div', { class: 'sheet-buttons' },
        done
          ? h('button', { class: 'btn', type: 'button', onclick: () => { match = newMatch(); newRound(); } }, 'Play again')
          : h('button', { class: 'btn', type: 'button', onclick: newRound }, 'Next round'),
        navButton('Home', '#/home', 'btn ghost')));
    sheet.hidden = false;
    (sheet.querySelector('button') as HTMLButtonElement).focus();
  }

  root.append(h('p', { class: 'sr-only' }, 'Player 1 draws on the left half, Player 2 on the right half.'));
  newRound();

  return () => { clearInterval(timer); caps.forEach(clearTimeout); stage.stop(); };
};
