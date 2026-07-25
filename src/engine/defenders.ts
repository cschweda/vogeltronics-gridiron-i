/**
 * The five tacklers: where they line up, how fast they react, and how they
 * pursue.
 *
 * The manual's whole pitch is that you can never be sure when or where the
 * next tackler will shift — so pursuit is deliberately *semi*-stochastic:
 * they close on the runner, but not on a solvable path. All randomness comes
 * from the injected Rng, so a seeded game replays exactly.
 */
import type { Skill } from '../types';
import { DEFENDER_COUNT, FIELD_COLS, FIELD_ROWS } from '../types';
import type { Rng } from './rng';

export interface Cell {
  row: number;
  col: number;
}

/** Tacklers never line up on top of the runner's first two yards. */
export const SCATTER_MIN_COL = 2;
export const SCATTER_MAX_COL = FIELD_COLS - 1;
/** At least one deep man plays back here — the manual's safety. */
export const DEEP_MIN_COL = 6;

/**
 * The runner's lane at the snap, kept clear for the first stride.
 *
 * Columns 2-8 is legal by the manual, but a tackler at column 2 in the middle
 * lane sits two presses from a runner starting at column 0 — the play is over
 * before the defense has moved once. Holding that one cell open guarantees a
 * stride of daylight without touching the formation rule itself.
 */
export const SNAP_ROW = Math.floor(FIELD_ROWS / 2);
export const SNAP_CLEAR_COL = SCATTER_MIN_COL;

/**
 * PRO 1 cadence. PRO 2 reacts 50% faster, i.e. 1.5x the rate (a 2/3 interval).
 *
 * What decides the game is defender moves per player key-press. Over 3000
 * seeded drives a competent runner scores on ~100% of drives at a ratio of
 * 0.25, ~38% at 0.5, ~20% at 0.75, and is shut out entirely at 1.0.
 *
 * This was 360ms, tuned against a simulated player pressing every 200ms and
 * always choosing the best lane. A person is slower than that and does not
 * play the optimum, so their real ratio sat near 0.8 — the shut-out end of
 * the curve, which is exactly how it felt. 560ms puts an unhurried ~250ms
 * presser at ~0.45 and still leaves PRO 2 a genuine step up.
 */
export const PRO1_INTERVAL_MS = 560;
export const PRO2_RATE_MULTIPLIER = 1.5;

/** How often the defense gets to move, in milliseconds. */
export function defenderIntervalMs(skill: Skill): number {
  return skill === 'pro2' ? PRO1_INTERVAL_MS / PRO2_RATE_MULTIPLIER : PRO1_INTERVAL_MS;
}

const key = (c: Cell): string => `${c.row},${c.col}`;

/**
 * Lay out a fresh defense. Distinct cells across columns 2–8, with at least
 * one deep man in 6–8; the manual fixes no formation (its two field diagrams
 * show different scatters), so this is re-rolled every play.
 */
export function scatterDefenders(rng: Rng): Cell[] {
  const taken = new Set<string>();
  const defenders: Cell[] = [];

  // Seat the deep man first so the guarantee cannot be squeezed out.
  const deep: Cell = {
    row: rng.intBetween(0, FIELD_ROWS - 1),
    col: rng.intBetween(DEEP_MIN_COL, SCATTER_MAX_COL),
  };
  defenders.push(deep);
  taken.add(key(deep));

  while (defenders.length < DEFENDER_COUNT) {
    const candidate: Cell = {
      row: rng.intBetween(0, FIELD_ROWS - 1),
      col: rng.intBetween(SCATTER_MIN_COL, SCATTER_MAX_COL),
    };
    if (candidate.row === SNAP_ROW && candidate.col === SNAP_CLEAR_COL) continue;
    if (taken.has(key(candidate))) continue;
    defenders.push(candidate);
    taken.add(key(candidate));
  }

  return defenders;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * Advance the defense one tick toward the runner.
 *
 * Each tackler independently picks whether to work the lane or the yard line,
 * and sometimes holds his ground entirely — that hesitation is what makes the
 * cutback work. A tackler will not step onto a cell another tackler holds,
 * but he *will* step onto the runner: that is a tackle.
 */
export function stepDefenders(defenders: readonly Cell[], runner: Cell, rng: Rng): Cell[] {
  const occupied = new Set(defenders.map(key));
  const next: Cell[] = [];

  for (const d of defenders) {
    occupied.delete(key(d));

    const rowGap = runner.row - d.row;
    const colGap = runner.col - d.col;
    const roll = rng.next();

    let moved: Cell = d;

    // 15% of ticks he simply doesn't commit.
    if (roll < 0.15) {
      moved = d;
    } else if (rowGap !== 0 && (colGap === 0 || roll < 0.55)) {
      moved = { row: d.row + Math.sign(rowGap), col: d.col };
    } else if (colGap !== 0) {
      moved = { row: d.row, col: d.col + Math.sign(colGap) };
    }

    const target: Cell = {
      row: clamp(moved.row, 0, FIELD_ROWS - 1),
      col: clamp(moved.col, 0, FIELD_COLS - 1),
    };

    // Blocked by a team-mate? Hold. Never double up on a cell.
    const resolved = occupied.has(key(target)) ? d : target;

    next.push(resolved);
    occupied.add(key(resolved));
  }

  return next;
}

/**
 * Index of the tackler occupying the runner's cell, or -1.
 *
 * A tackle counts no matter who moved into whom — front, side or behind —
 * which is also what keeps forward-mashing honest.
 */
export function findTackler(defenders: readonly Cell[], runner: Cell): number {
  return defenders.findIndex((d) => d.row === runner.row && d.col === runner.col);
}
