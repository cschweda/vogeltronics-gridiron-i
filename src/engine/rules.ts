/**
 * Downs, yardage, scoring, kicking, field position and the game clock.
 *
 * Every function here is pure: state in, state out. No DOM, no timers, no
 * randomness except through an injected Rng. That is what makes the whole
 * rulebook testable and what will let Gridiron 2 import it untouched.
 */
import type {
  ClockState,
  DriveState,
  FieldPosition,
  KickOutcome,
  PlayOutcome,
  Quarter,
} from '../types';
import { FIELD_LENGTH } from '../types';
import type { Rng } from './rng';

/** Points. The 1977 unit paid a flat 7 for six-and-the-kick. */
export const TOUCHDOWN_POINTS = 7;
export const FIELD_GOAL_POINTS = 3;

/** Kick distance is a single uniform roll; that roll *is* the punt/FG decision. */
export const KICK_MIN_YARDS = 1;
export const KICK_MAX_YARDS = 65;

/** Every drive — however it ended — restarts here. */
export const RESTART_YARD_LINE = 20;

/** 15.0 game-minutes, tracked in tenths so the clock is drift-proof. */
export const QUARTER_TENTHS = 150;

/** The clock drops a tenth of a game-minute for each real second of play. */
export const TENTHS_PER_REAL_SECOND = 1;

export function newDrive(): DriveState {
  return { ballOn: RESTART_YARD_LINE, down: 1, toGo: 10 };
}

export function yardsToGoal(drive: DriveState): number {
  return FIELD_LENGTH - drive.ballOn;
}

/**
 * Inside 10 yards of the goal the yards-to-go window blanks: the manual keys
 * this to distance-to-touchdown, not to the first-down marker. At exactly 10
 * the sticks and the goal line coincide, so 10 still reads honestly.
 */
export function isGoalToGo(drive: DriveState): boolean {
  return yardsToGoal(drive) < 10;
}

/** A fresh set of downs, with to-go clamped at the goal line. */
function firstAndTen(ballOn: number): DriveState {
  return { ballOn, down: 1, toGo: Math.min(10, FIELD_LENGTH - ballOn) };
}

/**
 * Resolve a running play that finished with the ball on `endYardLine`
 * (because the runner was tackled, or crossed the goal).
 */
export function resolveRun(drive: DriveState, endYardLine: number): PlayOutcome {
  if (endYardLine >= FIELD_LENGTH) {
    return { drive: newDrive(), points: TOUCHDOWN_POINTS, driveEnded: 'touchdown' };
  }

  const gained = endYardLine - drive.ballOn;

  if (gained >= drive.toGo) {
    return { drive: firstAndTen(endYardLine), points: 0, driveEnded: null };
  }

  if (drive.down < 4) {
    return {
      drive: {
        ballOn: endYardLine,
        down: (drive.down + 1) as DriveState['down'],
        toGo: drive.toGo - gained,
      },
      points: 0,
      driveEnded: null,
    };
  }

  return { drive: newDrive(), points: 0, driveEnded: 'downs' };
}

/**
 * Resolve a kick. Legal on 4th down only — `null` means the key did nothing.
 *
 * One uniform 1–65 roll decides everything: reach the goal line and it is a
 * made field goal, fall short and it was a punt. There is deliberately no
 * missed-field-goal state, and from beyond 65 yards out every kick punts.
 */
export function resolveKick(drive: DriveState, rng: Rng): KickOutcome | null {
  if (drive.down !== 4) return null;

  const distance = rng.intBetween(KICK_MIN_YARDS, KICK_MAX_YARDS);

  if (distance >= yardsToGoal(drive)) {
    return {
      drive: newDrive(),
      points: FIELD_GOAL_POINTS,
      driveEnded: 'field-goal',
      distance,
    };
  }

  return { drive: newDrive(), points: 0, driveEnded: 'punt', distance };
}

/**
 * Split an absolute yard line into the number and the tack mark the 1977
 * display would show: your own 42 reads `42⊣`, their 40 reads `⊢40`, and the
 * 50 wears no mark at all.
 */
export function fieldPosition(ballOn: number): FieldPosition {
  if (ballOn < 50) return { number: ballOn, marker: 'own' };
  if (ballOn > 50) return { number: FIELD_LENGTH - ballOn, marker: 'opponent' };
  return { number: 50, marker: 'none' };
}

/** Render tenths as the unit's decimal minutes: 75 -> "7.5". */
export function clockLabel(tenths: number): string {
  const whole = Math.floor(tenths / 10);
  const frac = tenths % 10;
  return `${whole}.${frac}`;
}

export interface ClockTick {
  tenths: number;
  /** Unspent fractional seconds — hand this back on the next call. */
  carry: number;
}

/**
 * Burn clock for `realSeconds` of live ball.
 *
 * The displayed clock only ever holds whole tenths, but a 60fps frame is a
 * small fraction of one. So anything that does not add up to a full tenth is
 * returned as `carry` and banked for the next frame: the clock stays an exact
 * integer, and no time is silently dropped on the floor.
 */
export function tickClock(tenths: number, realSeconds: number, carry = 0): ClockTick {
  const available = realSeconds * TENTHS_PER_REAL_SECOND + carry;
  const spent = Math.floor(available);
  return {
    tenths: Math.max(0, tenths - spent),
    carry: available - spent,
  };
}

export interface QuarterTransition {
  clock: ClockState;
  drive: DriveState;
  gameOver: boolean;
}

/**
 * Roll into the next quarter. Field position, down and to-go carry across the
 * Q1→Q2 and Q3→Q4 breaks; halftime is the solo stand-in for the manual's
 * second-half possession change, so Q3 opens on a fresh 1st & 10 at your 20.
 */
export function advanceQuarter(clock: ClockState, drive: DriveState): QuarterTransition {
  if (clock.quarter === 4) {
    return { clock, drive, gameOver: true };
  }

  const nextQuarter = (clock.quarter + 1) as Quarter;
  const halftime = clock.quarter === 2;

  return {
    clock: { quarter: nextQuarter, tenths: QUARTER_TENTHS },
    drive: halftime ? newDrive() : drive,
    gameOver: false,
  };
}
