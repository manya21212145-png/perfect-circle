// Profile: streak, badges, history graph with filters, sign in with nickname + PIN.

import { h, toast, topBar, type Screen } from './ui';
import { SHAPES, SHAPE_NAMES } from '../scoring/templates';
import { MODES, modeName } from '../modes';
import { BADGES } from '../progression/badges';
import { historySeries, filterAttempts, type HistoryFilter } from '../progression/history';
import { allAttempts, type Attempt } from '../data/indexeddb';
import { readPalette, rgba } from '../render/colours';
import { earnedBadges, login, logout, onSessionChange, rename, session, streak, syncNow } from '../state';

type ChartType = import('chart.js').Chart;

export const profileScreen: Screen = (root) => {
  const streakBox = h('div', { class: 'stats' });
  const account = h('section', { class: 'card', 'aria-label': 'Account' });
  const badgeGrid = h('ul', { class: 'badges' });
  const canvas = h('canvas', { 'aria-label': 'History graph of your scores', role: 'img' });
  const summary = h('p', { class: 'muted small' });
  const recent = h('ol', { class: 'recent' });

  const filters = h('form', { class: 'filters', 'aria-label': 'Graph filters' },
    h('label', {}, 'Shape ', h('select', { name: 'shape' },
      h('option', { value: 'all' }, 'All shapes'), ...SHAPES.map((s) => h('option', { value: s }, SHAPE_NAMES[s])))),
    h('label', {}, 'Mode ', h('select', { name: 'mode' },
      h('option', { value: 'all' }, 'All modes'), ...MODES.map((m) => h('option', { value: m }, m === 'timed' ? 'Time limit' : modeName({ mode: m }))))),
    h('label', {}, 'Days ', h('select', { name: 'days' },
      h('option', { value: '7' }, 'Last 7 days'), h('option', { value: '30', selected: true }, 'Last 30 days'),
      h('option', { value: '90' }, 'Last 90 days'), h('option', { value: '0' }, 'All time'))),
    h('label', { class: 'toggle' }, h('input', { type: 'checkbox', name: 'off' }), h('span', {}, 'Other hand only')));

  root.append(topBar('Profile'),
    h('main', { class: 'page wide' },
      streakBox,
      account,
      h('section', { class: 'card' }, h('h2', {}, 'History'), filters, h('div', { class: 'chart-box' }, canvas), summary,
        h('h3', {}, 'Recent attempts'), recent),
      h('section', { class: 'card' }, h('h2', {}, 'Badges'), badgeGrid)));

  let chart: ChartType | null = null;
  let attempts: Attempt[] = [];

  async function drawAccount() {
    const s = session();
    account.replaceChildren(h('h2', {}, 'Sign in'));
    if (s.nickname) {
      const nick = h('input', { name: 'nickname', value: s.nickname, autocomplete: 'username', required: true, pattern: '[A-Za-z0-9_\\-]{3,16}' });
      account.append(
        h('p', {}, `Signed in as `, h('strong', {}, s.nickname), '. Your progress is the same on every device you sign in on.'),
        h('form', { class: 'row', onsubmit: async (e: Event) => {
          e.preventDefault();
          try { await rename(nick.value.trim()); toast('Nickname changed'); } catch (err) { toast((err as Error).message); }
        } }, h('label', { class: 'grow' }, 'Nickname ', nick), h('button', { class: 'btn secondary', type: 'submit' }, 'Save')),
        h('div', { class: 'row' },
          h('button', { class: 'btn secondary', type: 'button', onclick: async () => { toast(await syncNow()); await load(); } }, 'Sync now'),
          h('button', { class: 'btn ghost', type: 'button', onclick: async () => { await logout(); } }, 'Sign out')));
      return;
    }
    if (!s.serverReachable) {
      account.append(h('p', { class: 'muted' }, 'Signing in needs the PC server. You can keep playing: progress is saved on this device.'));
      return;
    }
    const nick = h('input', { name: 'nickname', autocomplete: 'username', required: true, pattern: '[A-Za-z0-9_\\-]{3,16}', placeholder: '3–16 letters or numbers' });
    const pin = h('input', { name: 'pin', type: 'password', inputmode: 'numeric', autocomplete: 'current-password', required: true, pattern: '\\d{4}', maxlength: 4, placeholder: '4 digits' });
    account.append(
      h('p', { class: 'muted' }, 'Pick a nickname and a 4-digit PIN. The first time creates your player. Use the same ones on your phone and laptop to share progress.'),
      h('form', { class: 'stack', onsubmit: async (e: Event) => {
        e.preventDefault();
        try { await login(nick.value.trim(), pin.value); toast('Signed in'); await load(); } catch (err) { toast((err as Error).message); }
      } },
      h('label', {}, 'Nickname ', nick), h('label', {}, 'PIN ', pin),
      h('button', { class: 'btn', type: 'submit' }, 'Sign in')));
  }

  async function drawBadges() {
    const earned = await earnedBadges();
    badgeGrid.replaceChildren(...BADGES.map((b) => h('li', { class: earned[b.id] ? 'badge earned' : 'badge' },
      h('span', { class: 'badge-medal', 'aria-hidden': 'true' }, earned[b.id] ? '★' : '☆'),
      h('strong', {}, b.name),
      h('small', {}, earned[b.id] ? `Earned ${new Date(earned[b.id]).toLocaleDateString()}` : b.how))));
  }

  function currentFilter(): HistoryFilter {
    const d = new FormData(filters);
    const days = Number(d.get('days'));
    return {
      shape: d.get('shape') as HistoryFilter['shape'],
      mode: d.get('mode') as HistoryFilter['mode'],
      offHandOnly: d.get('off') === 'on',
      days: days || undefined,
    };
  }

  async function drawChart() {
    const f = currentFilter();
    const series = historySeries(attempts, f);
    const list = filterAttempts(attempts, f);
    summary.textContent = list.length
      ? `${list.length} attempt${list.length === 1 ? '' : 's'} · best ${Math.max(...list.map((a) => a.score)).toFixed(1)}% · average ${(list.reduce((s, a) => s + a.score, 0) / list.length).toFixed(1)}%`
      : 'No attempts match these filters yet.';
    recent.replaceChildren(...list.slice(-10).reverse().map((a) => h('li', {},
      h('span', {}, `${SHAPE_NAMES[a.shape]} · ${modeName({ mode: a.mode, limitS: (a.limit_s ?? undefined) as 5 | 3 | 2 | undefined })}`,
        a.off_hand ? h('span', { class: 'tag' }, 'Other hand') : null,
        a.daily_date ? h('span', { class: 'tag' }, 'Daily') : null),
      h('span', {}, `${a.score.toFixed(1)}%`))));

    const { Chart, ScatterController, LineController, PointElement, LineElement, LinearScale, Tooltip, Legend } = await import('chart.js');
    Chart.register(ScatterController, LineController, PointElement, LineElement, LinearScale, Tooltip, Legend);
    const pal = readPalette();
    const DAY = 86_400_000;
    const dayMid = (date: string) => Date.parse(date + 'T12:00:00Z');
    const data = {
      datasets: [
        { type: 'scatter' as const, label: 'Attempts', data: series.points.map((p) => ({ x: p.t, y: p.score })), backgroundColor: rgba(pal.muted, 0.6), pointRadius: 3 },
        { type: 'line' as const, label: 'Daily best', data: series.days.map((d) => ({ x: dayMid(d.date), y: d.best })), borderColor: rgba(pal.good), backgroundColor: rgba(pal.good), pointRadius: 2, tension: 0.2 },
        { type: 'line' as const, label: '7-day average', data: series.days.map((d) => ({ x: dayMid(d.date), y: d.avg7 })), borderColor: rgba(pal.ink), backgroundColor: rgba(pal.ink), borderDash: [6, 4], pointRadius: 0, tension: 0.2 },
      ],
    };
    if (chart) { chart.data = data; chart.update(); return; }
    chart = new Chart(canvas, {
      type: 'scatter',
      data,
      options: {
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: { type: 'linear', ticks: { color: rgba(pal.muted), maxTicksLimit: 6, callback: (v) => new Date(Number(v)).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) }, grid: { color: rgba(pal.muted, 0.15) }, suggestedMin: Date.now() - (f.days ?? 30) * DAY, suggestedMax: Date.now() },
          y: { min: 0, max: 100, ticks: { color: rgba(pal.muted), callback: (v) => v + '%' }, grid: { color: rgba(pal.muted, 0.15) } },
        },
        plugins: {
          legend: { labels: { color: rgba(pal.ink) } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(1)}%` } },
        },
      },
    });
  }

  async function load() {
    attempts = await allAttempts();
    const st = await streak();
    streakBox.replaceChildren(
      h('div', { class: 'stat' }, h('strong', {}, String(st.shown)), h('span', {}, 'day streak')),
      h('div', { class: 'stat' }, h('strong', {}, String(st.best)), h('span', {}, 'best streak')),
      h('div', { class: 'stat' }, h('strong', {}, String(attempts.length)), h('span', {}, 'attempts')));
    await drawBadges();
    if (chart) { chart.destroy(); chart = null; }
    await drawChart();
  }

  filters.addEventListener('change', () => { void drawChart(); });
  void drawAccount();
  void load();
  const off = onSessionChange(() => { void drawAccount(); void load(); });
  return () => { off(); chart?.destroy(); };
};
