// Disappearing ink mode: each part of the stroke fades to invisible 0.4 s after it is drawn.

export const INK_FADE_MS = 400;

/** How visible a segment drawn ageMs ago is: 1 = solid, 0 = gone. */
export function inkAlpha(ageMs: number): number {
  return Math.min(1, Math.max(0, 1 - ageMs / INK_FADE_MS));
}
