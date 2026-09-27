// Shared shapes of data used by the input, scoring and render modules.
// The server will import this file too, so keep it free of browser code.

/** One point of a stroke: where the pointer was, and when (in milliseconds). */
export interface Point {
  x: number;
  y: number;
  t: number;
}

/** A stroke is the list of points the player drew, in order. */
export type Stroke = Point[];

/** The position of the dot the player draws around. */
export interface Centre {
  cx: number;
  cy: number;
}
