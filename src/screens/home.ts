// Home: today's daily challenge card, current streak, and the main buttons.

import { go, h, navButton, shapeIcon, type Screen } from './ui';
import { HAS_SERVER } from '../config';
import { SHAPE_NAMES } from '../scoring/templates';
import { modeName } from '../modes';
import { getDaily, onSessionChange, session, streak, todaysChallenge } from '../state';

export const homeScreen: Screen = (root) => {
  const c = todaysChallenge();
  const dailyStatus = h('span', { class: 'muted' }, 'One scored attempt today');
  const streakEl = h('p', { class: 'streak' });
  const who = h('p', { class: 'muted small' });

  root.append(
    h('main', { class: 'page' },
      h('h1', { class: 'logo' }, 'Perfect Circle'),
      h('p', { class: 'muted' }, 'Draw a shape around the dot. How close can you get?'),
      h('button', { class: 'card daily-card', type: 'button', onclick: () => go('#/daily') },
        h('span', { class: 'card-icon' }, shapeIcon(c.shape)),
        h('span', { class: 'card-text' },
          h('strong', { class: 'card-title' }, `Daily challenge #${c.number}`),
          h('span', {}, `${SHAPE_NAMES[c.shape]} · ${modeName(c)}`),
          dailyStatus)),
      streakEl,
      h('nav', { class: 'menu', 'aria-label': 'Main menu' },
        navButton('Play', '#/setup', 'btn big'),
        HAS_SERVER ? navButton('Duel a friend', '#/duel', 'btn secondary big') : '',
        navButton('Split-screen duel', '#/split', 'btn secondary big'),
        h('div', { class: 'row' },
          navButton('Profile', '#/profile', 'btn ghost'),
          navButton('Settings', '#/settings', 'btn ghost'))),
      who));

  void getDaily(c.date).then((d) => {
    if (d) dailyStatus.textContent = `Done today: ${d.score.toFixed(1)}%`;
  });
  void streak().then((s) => {
    streakEl.textContent = s.shown > 0 ? `🔥 ${s.shown}-day streak` : 'Play today\'s challenge to start a streak';
  });

  const showWho = () => {
    const s = session();
    who.textContent = s.nickname
      ? `Signed in as ${s.nickname}`
      : s.serverReachable ? 'Playing as a guest — progress is saved on this device'
      : HAS_SERVER ? 'Offline — progress is saved on this device' : 'Your progress is saved on this device';
  };
  showWho();
  const off = onSessionChange(showWho);
  return () => { off(); };
};
