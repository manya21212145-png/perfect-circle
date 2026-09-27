// Ideal shapes, drawn around (0, 0) with their corners 1 unit from the centre.
// Screen coordinates: x goes right, y goes DOWN, angles are in radians.

export type Shape = 'circle' | 'square' | 'triangle' | 'star';
export type PolygonShape = Exclude<Shape, 'circle'>;

export const SHAPES: Shape[] = ['circle', 'square', 'triangle', 'star'];

export interface Template {
  /** Corners of the outline in order; the last one joins back to the first. */
  vertices: { x: number; y: number }[];
  /** Which vertices are "corners" the player must reach (for a star: the 5 tips). */
  corners: number[];
  /** Turning the shape by this many degrees gives the same shape again. */
  symmetryDeg: number;
}

const STAR_INNER = 0.381966; // inner points of a regular 5-point star, relative to the tips

/** A point at `radius` from the centre, at `deg` degrees (-90 = straight up). */
function polar(deg: number, radius = 1) {
  const a = (deg * Math.PI) / 180;
  return { x: radius * Math.cos(a), y: radius * Math.sin(a) };
}

export function template(shape: PolygonShape): Template {
  if (shape === 'square') {
    return { vertices: [45, 135, 225, 315].map((d) => polar(d)), corners: [0, 1, 2, 3], symmetryDeg: 90 };
  }
  if (shape === 'triangle') {
    return { vertices: [-90, 30, 150].map((d) => polar(d)), corners: [0, 1, 2], symmetryDeg: 120 };
  }
  // star: tip, inner, tip, inner ... starting at the top
  const vertices = [];
  for (let i = 0; i < 10; i++) vertices.push(polar(-90 + i * 36, i % 2 === 0 ? 1 : STAR_INNER));
  return { vertices, corners: [0, 2, 4, 6, 8], symmetryDeg: 72 };
}

/** Human-friendly names for screens and share text. */
export const SHAPE_NAMES: Record<Shape, string> = {
  circle: 'Circle',
  square: 'Square',
  triangle: 'Triangle',
  star: 'Star',
};
