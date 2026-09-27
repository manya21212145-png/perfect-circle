// Setup: pick a shape and a mode (and time limit / other hand), then Start.

import { h, shapeIcon, topBar, go, type Screen } from './ui';
import { SHAPES, SHAPE_NAMES } from '../scoring/templates';
import { MODES, modeName } from '../modes';
import { TIME_LIMITS_S } from '../modes/timed';
import { getSettings } from '../state';

const MODE_HELP: Record<string, string> = {
  classic: 'No countdown (10 s safety limit)',
  timed: 'Finish before the ring runs out',
  ink: 'Your line fades 0.4 s after you draw it',
  moving: 'The dot slowly moves on a figure-eight',
};

/** A group of radio buttons that work with Tab, arrow keys and Enter. */
function radioGroup(name: string, legend: string, options: { value: string; label: (Node | string)[]; help?: string }[], selected: string) {
  return h('fieldset', { class: 'choices' },
    h('legend', {}, legend),
    ...options.map((o) => h('label', { class: 'choice' },
      h('input', { type: 'radio', name, value: o.value, checked: o.value === selected }),
      h('span', { class: 'choice-body' }, ...o.label, o.help ? h('small', {}, o.help) : null))));
}

export const setupScreen: Screen = (root) => {
  const s = getSettings();
  const form = h('form', { class: 'page setup' },
    radioGroup('shape', 'Shape', SHAPES.map((x) => ({ value: x, label: [shapeIcon(x), SHAPE_NAMES[x]] })), s.last.shape),
    radioGroup('mode', 'Mode', MODES.map((m) => ({ value: m, label: [modeName({ mode: m }).replace(/^5 s /, '')], help: MODE_HELP[m] })), s.last.mode),
    radioGroup('limit', 'Time limit', TIME_LIMITS_S.map((t) => ({ value: String(t), label: [`${t} seconds`] })), String(s.last.limitS ?? 5)),
    h('label', { class: 'toggle' },
      h('input', { type: 'checkbox', name: 'off', checked: s.offHandDefault }),
      h('span', {}, "I'm using my other hand")),
    h('button', { class: 'btn big', type: 'submit' }, 'Start'));

  const limitSet = form.querySelectorAll('fieldset')[2] as HTMLFieldSetElement;
  const showLimit = () => { limitSet.hidden = (new FormData(form).get('mode')) !== 'timed'; };
  form.addEventListener('change', showLimit);
  showLimit();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = new FormData(form);
    const q = new URLSearchParams({
      shape: String(d.get('shape')),
      mode: String(d.get('mode')),
      limit: String(d.get('limit')),
      off: d.get('off') ? '1' : '0',
    });
    go('#/play?' + q);
  });

  root.append(topBar('Choose a shape and mode'), form);
};
