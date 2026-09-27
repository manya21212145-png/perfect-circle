// Small helpers shared by all screens: making elements, moving between screens,
// pop-up messages and the share sheet.

type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, string | number | boolean | EventListener | null | undefined>;

/**
 * h('button', { class: 'btn', onclick: go }, 'Play') makes <button class="btn">Play</button>.
 * Text is always added as text (never as HTML), so a nickname cannot inject code.
 */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(typeof c === 'number' ? String(c) : c);
  return el;
}

/** Link-style button that goes to another screen. */
export const navButton = (label: string, to: string, cls = 'btn') =>
  h('a', { class: cls, href: to }, label);

/** Top bar with a back button and a title. */
export function topBar(title: string, back = '#/home', extra?: Node) {
  return h('header', { class: 'topbar' },
    h('a', { class: 'btn ghost back', href: back, 'aria-label': 'Back' }, '←'),
    h('h1', {}, title),
    extra ?? h('span'));
}

// ---- screens (hash routes like #/play?shape=star) ----

export type Params = URLSearchParams & { path: string[] };
export type Screen = (root: HTMLElement, params: Params) => void | (() => void);

const routes = new Map<string, Screen>();
let cleanup: (() => void) | void;

export function addRoute(name: string, screen: Screen) { routes.set(name, screen); }

export function go(hash: string) {
  if (location.hash === hash) render(); else location.hash = hash;
}

export function render() {
  const [pathPart, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const path = pathPart.split('/').filter(Boolean);
  const screen = routes.get(path[0] ?? 'home') ?? routes.get('home')!;
  const params = new URLSearchParams(query) as Params;
  params.path = path;

  if (typeof cleanup === 'function') cleanup();
  const root = document.getElementById('app')!;
  root.replaceChildren();
  root.className = 'screen-' + (path[0] ?? 'home');
  cleanup = screen(root, params);
  // move keyboard focus to the new screen's heading, for keyboard and screen-reader users
  root.querySelector<HTMLElement>('h1, h2')?.setAttribute('tabindex', '-1');
  root.querySelector<HTMLElement>('h1, h2')?.focus({ preventScroll: true });
}

export function startRouter() {
  window.addEventListener('hashchange', render);
  render();
}

// ---- messages ----

export function toast(message: string, ms = 2600) {
  const el = h('div', { class: 'toast', role: 'status' }, message);
  document.body.append(el);
  setTimeout(() => el.remove(), ms);
}

/** Opens the phone's share sheet, or copies the text. Returns what happened. */
export async function shareOrCopy(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share) { await navigator.share({ text }); return 'shared'; }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'failed';
  }
  try {
    await navigator.clipboard.writeText(text);  // needs https or localhost
    return 'copied';
  } catch {
    // Older way that also works on plain http (phones on the Wi-Fi address)
    const area = h('textarea', { 'aria-hidden': 'true', style: 'position:fixed;opacity:0' });
    area.value = text;
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok ? 'copied' : 'failed';
  }
}

export const REASONS: Record<string, string> = {
  too_close: 'Too close to the dot. Try again.',
  wrong_way: 'Wrong way. Keep going in one direction.',
  not_closed: 'Close the shape. Try again.',
  too_slow: 'Too slow. Try again.',
  too_short: 'Draw a bigger shape.',
  no_stroke: 'No drawing arrived in time.',
};

export function verdict(s: number): string {
  if (s >= 97) return 'Basically a compass';
  if (s >= 93) return 'Nearly perfect';
  if (s >= 88) return 'Excellent';
  if (s >= 80) return 'Pretty good';
  if (s >= 65) return 'Wobbly, but recognisable';
  return "That's more of a potato";
}

/** Small outline icon of a shape, for pickers and cards. */
export function shapeIcon(shape: string): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '-12 -12 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('shape-icon');
  const pts: Record<string, string> = {
    square: '-7,-7 7,-7 7,7 -7,7',
    triangle: '0,-9 8,5.5 -8,5.5',
    star: Array.from({ length: 10 }, (_, i) => {
      const r = i % 2 ? 3.8 : 10;
      const a = (-90 + i * 36) * Math.PI / 180;
      return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a) + 1).toFixed(2)}`;
    }).join(' '),
  };
  const el = shape === 'circle' ? document.createElementNS(ns, 'circle') : document.createElementNS(ns, 'polygon');
  if (shape === 'circle') { el.setAttribute('r', '8.5'); } else el.setAttribute('points', pts[shape]);
  svg.append(el);
  return svg;
}
