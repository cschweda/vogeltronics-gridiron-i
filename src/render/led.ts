/**
 * Blip list -> lit 3x9 grid. Pure, display-agnostic, no DOM.
 *
 * The engine hands us anonymous blips; nothing here knows or cares which one
 * is the runner. That is exactly what lets Gridiron 2 add a ball in flight and
 * receivers without touching the render layer.
 */
import type { Blip, Intensity } from '../types';
import { FIELD_COLS, FIELD_ROWS } from '../types';

export interface LedCell {
  intensity: Intensity;
  blink: boolean;
}

const RANK: Record<Intensity, number> = { off: 0, dim: 1, bright: 2 };

export function toGrid(blips: readonly Blip[]): LedCell[][] {
  const grid: LedCell[][] = Array.from({ length: FIELD_ROWS }, () =>
    Array.from({ length: FIELD_COLS }, () => ({ intensity: 'off' as Intensity, blink: false })),
  );

  for (const blip of blips) {
    if (blip.row < 0 || blip.row >= FIELD_ROWS) continue;
    if (blip.col < 0 || blip.col >= FIELD_COLS) continue;

    const cell = grid[blip.row]![blip.col]!;
    // At the whistle the runner and his tackler share a cell: the brighter
    // state wins, and the blink survives so the hit is still readable.
    if (RANK[blip.intensity] > RANK[cell.intensity]) cell.intensity = blip.intensity;
    cell.blink = cell.blink || blip.blink;
  }

  return grid;
}
