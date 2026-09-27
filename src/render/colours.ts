// Colours: reads the colour tokens from style.css and mixes the line colour by error.

export type RGB = [number, number, number];

export interface Palette {
  ink: RGB;
  muted: RGB;
  good: RGB;
  mid: RGB;
  bad: RGB;
}

/** "#169B62" -> [22, 155, 98]. Unknown text becomes grey. */
export function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [128, 128, 128];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Reads --ink, --muted, --good, --mid, --bad (they change with light/dark theme). */
export function readPalette(root: HTMLElement = document.documentElement): Palette {
  const css = getComputedStyle(root);
  const get = (name: string) => hexToRgb(css.getPropertyValue(name));
  return { ink: get('--ink'), muted: get('--muted'), good: get('--good'), mid: get('--mid'), bad: get('--bad') };
}

/** Blend colour a towards colour b; t = 0 gives a, t = 1 gives b. */
export function mix(a: RGB, b: RGB, t: number): RGB {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
}

/** Error 0 -> green, 6% -> yellow, 12% or more -> red, blended in between. */
export function errorColour(e: number, p: Palette): RGB {
  const t = Math.min(1, Math.max(0, e / 0.12));
  return t < 0.5 ? mix(p.good, p.mid, t * 2) : mix(p.mid, p.bad, (t - 0.5) * 2);
}

/** [22, 155, 98] -> "rgba(22,155,98,1)" for the canvas. */
export function rgba(c: RGB, alpha = 1): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}
