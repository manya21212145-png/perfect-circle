// Time limit mode: a countdown of 5, 3 or 2 seconds. The attempt fails at 0.

export const TIME_LIMITS_S = [5, 3, 2] as const;
export type TimeLimit = (typeof TIME_LIMITS_S)[number];

export interface Timer {
  start(): void;
  cancel(): void;
  /** Milliseconds left (limit before start, 0 once expired). */
  remaining(): number;
  readonly expired: boolean;
}

/** Calls onExpire once, exactly limitMs after start(). */
export function createTimer(limitMs: number, onExpire: () => void): Timer {
  let startedAt: number | null = null;
  let handle: ReturnType<typeof setTimeout> | null = null;
  let expired = false;

  return {
    start() {
      if (handle !== null) clearTimeout(handle);
      expired = false;
      startedAt = Date.now();
      handle = setTimeout(() => {
        expired = true;
        handle = null;
        onExpire();
      }, limitMs);
    },
    cancel() {
      if (handle !== null) clearTimeout(handle);
      handle = null;
    },
    remaining() {
      if (expired) return 0;
      if (startedAt === null) return limitMs;
      return Math.max(0, limitMs - (Date.now() - startedAt));
    },
    get expired() {
      return expired;
    },
  };
}
