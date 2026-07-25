/**
 * Seedable PRNG (mulberry32).
 *
 * Every random draw in Gridiron — defender scatter, defender pursuit, kick
 * distance — flows through one injected instance of this. That makes any game
 * replayable from its seed and makes every test deterministic.
 *
 * Engine module: no DOM, no `window`, no `document`.
 */
export interface Rng {
  /** Next float in [0, 1). */
  next(): number;
  /** Integer in [min, max], inclusive on both ends. */
  intBetween(min: number, max: number): number;
  /** Uniformly pick one element. Throws on an empty array. */
  pick<T>(items: readonly T[]): T;
  /** The seed this generator was created with. */
  readonly seed: number;
}

export function makeRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    seed,
    next,
    intBetween(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('rng.pick: empty array');
      return items[Math.floor(next() * items.length)] as T;
    },
  };
}
