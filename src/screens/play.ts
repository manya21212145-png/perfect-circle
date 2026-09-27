// Play and Result screens (solo play and the daily challenge).
// Route: #/play?shape=star&mode=timed&limit=3&off=1      (solo)
//        #/play?daily=1                                  (today's daily challenge)

import { Board, Stage } from './board';
import { h, navButton, REASONS, shapeIcon, shareOrCopy, toast, verdict, type Screen } from './ui';
import { SHAPES, SHAPE_NAMES, type Shape } from '../scoring/templates';
import { MODES, modeName, type Mode, type PlaySettings } from '../modes';
import { TIME_LIMITS_S, type TimeLimit } from '../modes/timed';
import { shareText } from '../daily/share';
import { playSound } from '../render/sound';
import type { Badge } from '../progression/badges';
import {
  bestFor, getDaily, getSettings, postDaily, recordAttempt, saveSettings, setDaily, streak, todaysChallenge,
} from '../state';

let stage: Stage | null = null;
export function getStage(): Stage {
  stage ??= new Stage(document.getElementById('board') as HTMLCanvasElement);
  return stage;
}

/** Reads shape/mode/limit/off-hand from the address, falling back to the last used. */
export function settingsFromParams(params: URLSearchParams): PlaySettings {
  const s = getSettings();
  const shape = (SHAPES as string[]).includes(params.get('shape') ?? '') ? params.get('shape') as Shape : s.last.shape;
  const mode = (MODES as string[]).includes(params.get('mode') ?? '') ? params.get('mode') as Mode : s.last.mode;
  const limit = Number(params.get('limit'));
  const limitS = (TIME_LIMITS_S as readonly number[]).includes(limit) ? limit as TimeLimit : s.last.limitS ?? 5;
  const offHand = params.has('off') ? params.get('off') === '1' : s.offHandDefault;
  return { shape, mode, limitS, offHand };
}

/** A pop-up card for each new badge. */
export function showBadges(badges: Badge[]) {
  badges.forEach((b, i) => setTimeout(() => {
    const card = h('div', { class: 'badge-pop', role: 'status' },
      h('div', { class: 'badge-medal', 'aria-hidden': 'true' }, '★'),
      h('div', {}, h('strong', {}, 'New badge: ' + b.name), h('div', { class: 'muted' }, b.how)));
    document.body.append(card);
    setTimeout(() => card.remove(), 4000);
  }, i * 1200));
}

export const playScreen: Screen = (root, params) => {
  const challenge = params.get('daily') === '1' ? todaysChallenge() : null;
  const settings: PlaySettings = challenge
    ? { shape: challenge.shape, mode: challenge.mode, limitS: challenge.limitS, offHand: getSettings().offHandDefault }
    : settingsFromParams(params);
  if (!challenge) saveSettings({ last: { shape: settings.shape, mode: settings.mode, limitS: settings.limitS } });

  const hint = `Draw a ${SHAPE_NAMES[settings.shape].toLowerCase()} around the dot`;
  const title = challenge ? `Daily #${challenge.number}` : SHAPE_NAMES[settings.shape];
  const bestEl = h('span', { class: 'best' });
  const tag = h('p', { class: 'mode-tag' },
    modeName(settings), settings.offHand ? ' · Other hand' : '');
  const scoreEl = h('div', { class: 'score', 'aria-live': 'off' });
  const noteEl = h('div', { class: 'note dim', 'aria-live': 'polite' }, hint);
  const sheet = h('section', { class: 'sheet', hidden: true, 'aria-label': 'Result' });

  root.append(
    h('header', { class: 'topbar overlay' },
      h('a', { class: 'btn ghost back', href: challenge ? '#/daily' : '#/setup', 'aria-label': 'Back' }, '←'),
      h('div', { class: 'title-block' }, h('h1', {}, shapeIcon(settings.shape), ' ', title), tag),
      bestEl),
    h('div', { class: 'readout' }, scoreEl, noteEl),
    sheet,
  );

  const showBest = async () => {
    const b = await bestFor(settings.shape);
    bestEl.textContent = b === null ? '' : `Best ${b.toFixed(1)}%`;
  };
  void showBest();

  const board = new Board(settings);
  let dailyDone = false;
  if (challenge) void getDaily(challenge.date).then((d) => { dailyDone = !!d; if (d) tag.append(' · Practice'); });

  board.onStartDrawing = () => {
    sheet.hidden = true;
    noteEl.textContent = '';
    scoreEl.textContent = '';
  };
  board.onLive = (s) => { scoreEl.textContent = s === null ? '' : s.toFixed(1) + '%'; };

  board.onFinish = async (r) => {
    const sound = getSettings().sound;
    if (!r.ok) {
      playSound('bad', sound);
      scoreEl.textContent = '';
      noteEl.textContent = REASONS[r.reason];
      noteEl.classList.remove('dim');
      showSheet(null);
      return;
    }
    playSound('good', sound);
    scoreEl.textContent = r.score.toFixed(1) + '%';
    noteEl.textContent = verdict(r.score);
    noteEl.classList.remove('dim');

    const countsAsDaily = !!challenge && !dailyDone;
    const saved = await recordAttempt(settings, r.score, countsAsDaily ? challenge!.date : null);
    if (countsAsDaily) {
      dailyDone = true;
      await setDaily({ date: challenge!.date, score: r.score, errors: r.errors, stroke: r.stroke128 });
      void postDaily(challenge!.date);
    }
    if (saved.best && !challenge) noteEl.textContent += '. New best!';
    void showBest();
    showBadges(saved.newBadges);
    showSheet(r.score, countsAsDaily ? r.errors : null);
  };

  function showSheet(score: number | null, dailyErrors: number[] | null = null) {
    const retry = h('button', { class: 'btn', type: 'button', onclick: () => {
      board.reset();
      sheet.hidden = true;
      scoreEl.textContent = '';
      noteEl.textContent = hint;
      noteEl.classList.add('dim');
    } }, score === null ? 'Retry' : challenge ? 'Practice' : 'Retry');

    const buttons: Node[] = [retry];
    if (score !== null) {
      buttons.push(h('button', { class: 'btn secondary', type: 'button', onclick: async () => {
        let text: string;
        if (challenge && dailyErrors) {
          const st = await streak();
          text = shareText({ ...challenge, score, errors: dailyErrors, streak: st.shown });
        } else {
          text = `I drew a ${score.toFixed(1)}% ${SHAPE_NAMES[settings.shape].toLowerCase()} (${modeName(settings).toLowerCase()}) in Perfect Circle. Can you beat it?`;
        }
        const how = await shareOrCopy(text);
        if (how === 'copied') toast('Copied — paste it anywhere');
      } }, 'Share'));
    }
    buttons.push(challenge ? navButton('Daily', '#/daily', 'btn secondary') : navButton('Change mode', '#/setup', 'btn secondary'));
    buttons.push(navButton('Home', '#/home', 'btn ghost'));
    sheet.replaceChildren(h('div', { class: 'sheet-buttons' }, ...buttons));
    sheet.hidden = false;
  }

  const st = getStage();
  st.start([board]);
  board.reset();
  return () => st.stop();
};
