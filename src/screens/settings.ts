// Settings: theme, sound, other-hand default, export and reset. Test tools in test mode.

import { h, toast, topBar, type Screen } from './ui';
import { clearAll, exportAll } from '../data/indexeddb';
import { getSettings, isTestMode, saveSettings, today, type Settings } from '../state';

export const settingsScreen: Screen = (root) => {
  const s = getSettings();

  const theme = h('fieldset', { class: 'choices' }, h('legend', {}, 'Theme'),
    ...(['system', 'light', 'dark'] as const).map((t) => h('label', { class: 'choice' },
      h('input', { type: 'radio', name: 'theme', value: t, checked: s.theme === t }),
      h('span', { class: 'choice-body' }, t === 'system' ? 'Same as device' : t === 'light' ? 'Whiteboard (light)' : 'Chalkboard (dark)'))));
  theme.addEventListener('change', (e) => saveSettings({ theme: (e.target as HTMLInputElement).value as Settings['theme'] }));

  const toggle = (label: string, key: 'sound' | 'offHandDefault') => {
    const box = h('input', { type: 'checkbox', checked: s[key] });
    box.addEventListener('change', () => saveSettings({ [key]: box.checked }));
    return h('label', { class: 'toggle' }, box, h('span', {}, label));
  };

  let armed = false;
  const reset = h('button', { class: 'btn danger', type: 'button', onclick: async () => {
    if (!armed) { armed = true; reset.textContent = 'Tap again to delete everything on this device'; return; }
    await clearAll();
    armed = false;
    reset.textContent = 'Reset data on this device';
    toast('All data on this device was deleted');
  } }, 'Reset data on this device');

  const exportBtn = h('button', { class: 'btn secondary', type: 'button', onclick: async () => {
    const data = await exportAll();
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = h('a', { href: url, download: `perfect-circle-${today()}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } }, 'Export my data');

  const page = h('main', { class: 'page' },
    h('section', { class: 'card' }, theme),
    h('section', { class: 'card stack' },
      toggle('Sound effects', 'sound'),
      toggle('Use my other hand by default', 'offHandDefault')),
    h('section', { class: 'card stack' },
      h('h2', {}, 'Your data'),
      h('p', { class: 'muted small' }, 'Attempts, badges and your streak are saved on this device. If you sign in, they are also saved on the PC running the game — nowhere else.'),
      h('div', { class: 'row' }, exportBtn, reset)));

  if (isTestMode()) {
    const date = h('input', { type: 'date', value: s.dateOverride ?? '' });
    page.append(h('section', { class: 'card stack test-tools' },
      h('h2', {}, 'Test tools (test server only)'),
      h('p', { class: 'muted small' }, 'Pretend today is another date, to test the daily challenge and streaks.'),
      h('label', {}, 'Date override ', date),
      h('div', { class: 'row' },
        h('button', { class: 'btn secondary', type: 'button', onclick: () => { saveSettings({ dateOverride: date.value || null }); toast('Today is now ' + today()); } }, 'Use this date'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => { saveSettings({ dateOverride: null }); date.value = ''; toast('Back to the real date'); } }, 'Clear'))));
  }

  page.append(h('p', { class: 'muted small center' }, 'Perfect Circle v0.1'));
  root.append(topBar('Settings'), page);
};
