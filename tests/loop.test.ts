import { describe, expect, test } from 'vitest';
import { MAX_FRAME_MS, TICK_MS, createLoop } from '../src/engine/loop';

describe('fixed-timestep loop', () => {
  test('emits nothing until a whole tick has elapsed', () => {
    const ticks: number[] = [];
    const loop = createLoop(TICK_MS, (d) => ticks.push(d));
    loop.reset(0);
    loop.advance(TICK_MS / 2);
    expect(ticks).toEqual([]);
  });

  test('emits one tick per elapsed step, at a fixed size', () => {
    const ticks: number[] = [];
    const loop = createLoop(10, (d) => ticks.push(d));
    loop.reset(0);
    loop.advance(35);
    expect(ticks).toEqual([10, 10, 10]);
  });

  test('carries the remainder into the next frame', () => {
    const ticks: number[] = [];
    const loop = createLoop(10, (d) => ticks.push(d));
    loop.reset(0);
    loop.advance(15);
    loop.advance(20);
    expect(ticks).toEqual([10, 10]);
  });

  test('clamps a long stall so a backgrounded tab cannot spiral', () => {
    let count = 0;
    const loop = createLoop(10, () => count++);
    loop.reset(0);
    loop.advance(60_000);
    expect(count).toBe(MAX_FRAME_MS / 10);
  });

  test('reset drops any banked time', () => {
    const ticks: number[] = [];
    const loop = createLoop(10, (d) => ticks.push(d));
    loop.reset(0);
    loop.advance(9);
    loop.reset(1000);
    loop.advance(1009);
    expect(ticks).toEqual([]);
  });
});
