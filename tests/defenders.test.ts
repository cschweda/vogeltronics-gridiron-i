import { describe, expect, test } from 'vitest';
import { makeRng } from '../src/engine/rng';
import {
  DEEP_MIN_COL,
  SCATTER_MAX_COL,
  SCATTER_MIN_COL,
  defenderIntervalMs,
  findTackler,
  scatterDefenders,
  stepDefenders,
} from '../src/engine/defenders';
import { DEFENDER_COUNT, FIELD_COLS, FIELD_ROWS } from '../src/types';

const seeds = Array.from({ length: 200 }, (_, i) => i * 7919 + 3);

describe('pre-snap scatter', () => {
  test('puts exactly five tacklers on the field', () => {
    expect(scatterDefenders(makeRng(1977))).toHaveLength(DEFENDER_COUNT);
  });

  test('never lines a tackler up in columns 0-1, where the runner starts', () => {
    for (const seed of seeds) {
      for (const d of scatterDefenders(makeRng(seed))) {
        expect(d.col).toBeGreaterThanOrEqual(SCATTER_MIN_COL);
        expect(d.col).toBeLessThanOrEqual(SCATTER_MAX_COL);
      }
    }
  });

  test('always leaves at least one deep man in columns 6-8', () => {
    for (const seed of seeds) {
      const deep = scatterDefenders(makeRng(seed)).filter((d) => d.col >= DEEP_MIN_COL);
      expect(deep.length).toBeGreaterThanOrEqual(1);
    }
  });

  test('keeps every tackler in a real lane', () => {
    for (const seed of seeds) {
      for (const d of scatterDefenders(makeRng(seed))) {
        expect(d.row).toBeGreaterThanOrEqual(0);
        expect(d.row).toBeLessThan(FIELD_ROWS);
      }
    }
  });

  test('never stacks two tacklers in one cell', () => {
    for (const seed of seeds) {
      const cells = scatterDefenders(makeRng(seed)).map((d) => `${d.row},${d.col}`);
      expect(new Set(cells).size).toBe(DEFENDER_COUNT);
    }
  });

  test('is deterministic for a given seed', () => {
    expect(scatterDefenders(makeRng(42))).toEqual(scatterDefenders(makeRng(42)));
  });

  test('varies between seeds', () => {
    const a = JSON.stringify(scatterDefenders(makeRng(1)));
    const b = JSON.stringify(scatterDefenders(makeRng(2)));
    expect(a).not.toBe(b);
  });
});

describe('skill cadence', () => {
  test('PRO 2 moves the defense faster than PRO 1', () => {
    expect(defenderIntervalMs('pro2')).toBeLessThan(defenderIntervalMs('pro1'));
  });

  test('PRO 2 reacts 50% faster — a 1.5x rate, so a 2/3 interval', () => {
    expect(defenderIntervalMs('pro2')).toBeCloseTo(defenderIntervalMs('pro1') / 1.5, 5);
  });
});

describe('pursuit', () => {
  test('closes on the runner over a series of ticks', () => {
    const rng = makeRng(1977);
    const runner = { row: 1, col: 4 };
    let defenders = [{ row: 0, col: 8 }];
    const startDistance = Math.abs(defenders[0]!.row - runner.row) + Math.abs(defenders[0]!.col - runner.col);

    for (let i = 0; i < 30; i++) defenders = stepDefenders(defenders, runner, rng);

    const endDistance = Math.abs(defenders[0]!.row - runner.row) + Math.abs(defenders[0]!.col - runner.col);
    expect(endDistance).toBeLessThan(startDistance);
  });

  test('moves at most one cell per tick', () => {
    const rng = makeRng(5);
    const runner = { row: 2, col: 0 };
    let defenders = [{ row: 0, col: 8 }];

    for (let i = 0; i < 40; i++) {
      const before = defenders[0]!;
      const after = stepDefenders(defenders, runner, rng)[0]!;
      const moved = Math.abs(after.row - before.row) + Math.abs(after.col - before.col);
      expect(moved).toBeLessThanOrEqual(1);
      defenders = [after];
    }
  });

  test('keeps every tackler on the field', () => {
    const rng = makeRng(31);
    const runner = { row: 0, col: 0 };
    let defenders = scatterDefenders(makeRng(31));

    for (let i = 0; i < 200; i++) {
      defenders = stepDefenders(defenders, runner, rng);
      for (const d of defenders) {
        expect(d.row).toBeGreaterThanOrEqual(0);
        expect(d.row).toBeLessThan(FIELD_ROWS);
        expect(d.col).toBeGreaterThanOrEqual(0);
        expect(d.col).toBeLessThan(FIELD_COLS);
      }
    }
  });

  test('never stacks two tacklers in one cell while pursuing', () => {
    const rng = makeRng(77);
    const runner = { row: 1, col: 0 };
    let defenders = scatterDefenders(makeRng(77));

    for (let i = 0; i < 200; i++) {
      defenders = stepDefenders(defenders, runner, rng);
      const cells = defenders.map((d) => `${d.row},${d.col}`);
      expect(new Set(cells).size).toBe(defenders.length);
    }
  });

  test('moves unpredictably rather than on a fixed path', () => {
    const runner = { row: 1, col: 0 };
    const start = [{ row: 1, col: 8 }];
    const pathFor = (seed: number) => {
      const rng = makeRng(seed);
      let d = start;
      const path: string[] = [];
      for (let i = 0; i < 12; i++) {
        d = stepDefenders(d, runner, rng);
        path.push(`${d[0]!.row},${d[0]!.col}`);
      }
      return path.join(' ');
    };
    expect(pathFor(1)).not.toBe(pathFor(2));
  });
});

describe('tackle detection', () => {
  test('finds the tackler sharing the runner cell, whoever moved into whom', () => {
    const defenders = [
      { row: 0, col: 3 },
      { row: 2, col: 5 },
      { row: 1, col: 4 },
    ];
    expect(findTackler(defenders, { row: 1, col: 4 })).toBe(2);
  });

  test('returns -1 when nobody has the runner', () => {
    const defenders = [
      { row: 0, col: 3 },
      { row: 2, col: 5 },
    ];
    expect(findTackler(defenders, { row: 1, col: 4 })).toBe(-1);
  });
});
