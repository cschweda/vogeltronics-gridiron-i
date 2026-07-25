/**
 * Fixed-timestep accumulator.
 *
 * Engine module, so it holds no reference to `requestAnimationFrame` or any
 * other DOM API — main.ts supplies the timestamps. That keeps the simulation
 * reproducible: the same sequence of timestamps always yields the same ticks.
 */

/** One simulation step. 60Hz. */
export const TICK_MS = 1000 / 60;

/**
 * Longest single frame we will simulate. A backgrounded tab can hand back a
 * multi-second gap; without this the catch-up loop would run thousands of
 * ticks and lock the page.
 */
export const MAX_FRAME_MS = 250;

export interface Loop {
  /** Feed the current timestamp; fires zero or more fixed ticks. */
  advance(nowMs: number): void;
  /** Re-base the clock and discard banked time. */
  reset(nowMs: number): void;
}

export function createLoop(tickMs: number, onTick: (deltaMs: number) => void): Loop {
  let last = 0;
  let accumulator = 0;

  return {
    reset(nowMs: number): void {
      last = nowMs;
      accumulator = 0;
    },
    advance(nowMs: number): void {
      const elapsed = Math.min(Math.max(0, nowMs - last), MAX_FRAME_MS);
      last = nowMs;
      accumulator += elapsed;

      while (accumulator >= tickMs) {
        accumulator -= tickMs;
        onTick(tickMs);
      }
    },
  };
}
