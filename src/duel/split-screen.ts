// Split-screen duel on one device: the left half is player 1, the right half player 2.
// Each finger belongs to the half where it first touched, even if it slides across.

export type Player = 1 | 2;

/** Which player a touch at x belongs to on a screen `width` px wide. */
export function assignTouch(x: number, width: number): Player {
  return x < width / 2 ? 1 : 2;
}

/** Remembers the owner of each finger (pointer id) until it is lifted. */
export function createTouchAssigner() {
  const owners = new Map<number, Player>();
  return {
    /** Call on pointerdown: fixes the owner from the starting x. */
    start(pointerId: number, x: number, width: number): Player {
      const p = assignTouch(x, width);
      owners.set(pointerId, p);
      return p;
    },
    /** Call on pointermove: the owner never changes while the finger is down. */
    owner(pointerId: number): Player | undefined {
      return owners.get(pointerId);
    },
    end(pointerId: number) {
      owners.delete(pointerId);
    },
  };
}
