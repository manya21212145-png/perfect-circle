// Daily: challenge number, shape and mode; one scored attempt; then result, share and leaderboard.

import { h, navButton, shapeIcon, shareOrCopy, toast, topBar, type Screen } from './ui';
import { HAS_SERVER } from '../config';
import { SHAPE_NAMES } from '../scoring/templates';
import { modeName } from '../modes';
import { shareText, segmentErrors, squareFor } from '../daily/share';
import { api } from '../data/api';
import { getDaily, postDaily, session, streak, todaysChallenge } from '../state';

export const dailyScreen: Screen = (root) => {
  const c = todaysChallenge();
  const body = h('div', { class: 'stack' });
  const board = h('section', { class: 'card', 'aria-label': 'Leaderboard' });

  root.append(topBar(`Daily challenge #${c.number}`),
    h('main', { class: 'page' },
      h('div', { class: 'card daily-card' },
        h('div', { class: 'card-icon' }, shapeIcon(c.shape)),
        h('div', {},
          h('h2', {}, `${SHAPE_NAMES[c.shape]} · ${modeName(c)}`),
          h('p', { class: 'muted' }, `${c.date} (UTC). The same challenge for everyone; a new one at 00:00 UTC (05:30 in India).`))),
      body,
      board));

  void (async () => {
    const done = await postDaily(c.date) ?? await getDaily(c.date);
    const st = await streak();
    if (!done) {
      body.append(
        h('p', {}, 'You get one scored attempt today. If an attempt is rejected (too close, not closed…) you can try again.'),
        navButton('Play today\'s challenge', '#/play?daily=1', 'btn big'));
    } else {
      const text = shareText({ ...c, score: done.score, errors: done.errors, streak: st.shown });
      const squares = segmentErrors(done.errors).map(squareFor).join('');
      body.append(
        h('p', { class: 'big-score' }, `${done.score.toFixed(1)}%`),
        h('p', { class: 'squares', 'aria-label': 'Accuracy of five parts of your stroke' }, squares),
        done.serverScore != null ? h('p', { class: 'muted small' }, `Checked by the PC server: ${done.serverScore.toFixed(1)}%`) : '',
        h('p', {}, `Streak: ${st.shown} ${st.shown === 1 ? 'day' : 'days'}`),
        h('div', { class: 'row' },
          h('button', { class: 'btn', type: 'button', onclick: async () => {
            if ((await shareOrCopy(text)) === 'copied') toast('Copied — paste it into WhatsApp or anywhere');
          } }, 'Share result'),
          navButton('Practice (not counted)', '#/play?daily=1', 'btn secondary')),
        h('pre', { class: 'share-preview' }, text));
    }

    // Leaderboard (needs the PC server)
    if (!HAS_SERVER) { board.remove(); return; }
    board.append(h('h2', {}, 'Top 100 today'));
    try {
      const { rows } = await api.leaderboard(c.date);
      if (!rows.length) board.append(h('p', { class: 'muted' }, 'No scores yet. Sign in on Profile to appear here.'));
      else board.append(h('ol', { class: 'leaderboard' }, ...rows.map((r) =>
        h('li', { class: r.nickname === session().nickname ? 'me' : '' }, h('span', {}, r.nickname), h('span', {}, `${r.score.toFixed(1)}%`)))));
    } catch {
      board.append(h('p', { class: 'muted' }, 'The leaderboard needs the PC server. Your result is saved on this device.'));
    }
  })();
};
