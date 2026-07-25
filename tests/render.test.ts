import { describe, expect, test } from 'vitest';
import { toGrid } from '../src/render/led';
import { scoreReadout, statusReadout } from '../src/render/status';
import { FIELD_COLS, FIELD_ROWS } from '../src/types';

describe('led grid', () => {
  test('is always a full 3x9 of cells', () => {
    const grid = toGrid([]);
    expect(grid).toHaveLength(FIELD_ROWS);
    for (const row of grid) expect(row).toHaveLength(FIELD_COLS);
  });

  test('leaves every cell dark when nothing is lit', () => {
    for (const row of toGrid([])) {
      for (const cell of row) {
        expect(cell.intensity).toBe('off');
        expect(cell.blink).toBe(false);
      }
    }
  });

  test('lights the cell a blip occupies', () => {
    const grid = toGrid([{ row: 1, col: 4, intensity: 'bright', blink: false }]);
    expect(grid[1]![4]!.intensity).toBe('bright');
    expect(grid[0]![0]!.intensity).toBe('off');
  });

  test('a tackle lights one cell bright and blinking, not two cells', () => {
    // At the whistle the runner and the tackler share a cell.
    const grid = toGrid([
      { row: 2, col: 5, intensity: 'dim', blink: true },
      { row: 2, col: 5, intensity: 'bright', blink: false },
    ]);
    expect(grid[2]![5]!.intensity).toBe('bright');
    expect(grid[2]![5]!.blink).toBe(true);
  });

  test('ignores blips that fall outside the window', () => {
    expect(() => toGrid([{ row: 9, col: 99, intensity: 'bright', blink: false }])).not.toThrow();
    const grid = toGrid([{ row: 9, col: 99, intensity: 'bright', blink: false }]);
    expect(grid.flat().every((c) => c.intensity === 'off')).toBe(true);
  });
});

describe('status readout', () => {
  test('shows down, field position and yards to go', () => {
    const out = statusReadout({ ballOn: 42, down: 3, toGo: 4 });
    expect(out.left).toBe('3');
    expect(out.middle).toBe('42');
    expect(out.right).toBe('4');
  });

  test('puts the tack mark on your side of the 50 on your own half', () => {
    expect(statusReadout({ ballOn: 42, down: 3, toGo: 4 }).marker).toBe('own');
  });

  test('flips the tack mark and counts down past midfield', () => {
    const out = statusReadout({ ballOn: 60, down: 1, toGo: 10 });
    expect(out.middle).toBe('40');
    expect(out.marker).toBe('opponent');
  });

  test('wears no tack mark at midfield', () => {
    expect(statusReadout({ ballOn: 50, down: 1, toGo: 10 }).marker).toBe('none');
  });

  test('blanks the yards-to-go window inside the 10', () => {
    const out = statusReadout({ ballOn: 94, down: 2, toGo: 6 });
    expect(out.right).toBe('');
  });

  test('still shows yards to go at exactly 10 out, where the sticks are the goal', () => {
    expect(statusReadout({ ballOn: 90, down: 1, toGo: 10 }).right).toBe('10');
  });
});

describe('score readout', () => {
  test('shows your score, the time, and a visitor window that stays zero', () => {
    const out = scoreReadout(17, { quarter: 2, tenths: 75 });
    expect(out.left).toBe('17');
    expect(out.middle).toBe('7.5');
    expect(out.right).toBe('0');
  });

  test('shows a shut-out as zero rather than blank', () => {
    expect(scoreReadout(0, { quarter: 1, tenths: 150 }).left).toBe('0');
  });

  test('reads 0.0 at the end of a quarter', () => {
    expect(scoreReadout(7, { quarter: 4, tenths: 0 }).middle).toBe('0.0');
  });

  test('carries no tack mark', () => {
    expect(scoreReadout(7, { quarter: 1, tenths: 150 }).marker).toBe('none');
  });
});
