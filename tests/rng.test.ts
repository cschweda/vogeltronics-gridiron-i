import { describe, expect, test } from 'vitest';
import { makeRng } from '../src/engine/rng';

describe('makeRng', () => {
  test('produces the same sequence for the same seed', () => {
    const a = makeRng(1977);
    const b = makeRng(1977);
    const seqA = [a.next(), a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  test('produces a different sequence for a different seed', () => {
    const a = makeRng(1977);
    const b = makeRng(2100);
    expect(a.next()).not.toBe(b.next());
  });

  test('yields floats in [0, 1)', () => {
    const rng = makeRng(42);
    for (let i = 0; i < 500; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  test('intBetween returns inclusive bounds and never exceeds them', () => {
    const rng = makeRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const v = rng.intBetween(1, 5);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(5);
      seen.add(v);
    }
    // over 500 draws a 5-wide range should cover every value
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  test('intBetween(n, n) always returns n', () => {
    const rng = makeRng(3);
    expect(rng.intBetween(4, 4)).toBe(4);
  });

  test('pick returns an element of the array', () => {
    const rng = makeRng(11);
    const items = ['a', 'b', 'c'];
    for (let i = 0; i < 50; i++) {
      expect(items).toContain(rng.pick(items));
    }
  });
});
