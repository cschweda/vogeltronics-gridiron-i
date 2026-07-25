/** Shared domain types. Pure data — no DOM, safe to import in Node and tests. */

export const FIELD_ROWS = 3;
export const FIELD_COLS = 9;
export const FIELD_LENGTH = 100;
export const DEFENDER_COUNT = 5;

export type Down = 1 | 2 | 3 | 4;
export type Quarter = 1 | 2 | 3 | 4;

/** Where the ball is and what it will take to keep it. */
export interface DriveState {
  /** Absolute yard line 0–100, measured from your own goal line. */
  ballOn: number;
  down: Down;
  /** Yards still needed for a first down. */
  toGo: number;
}

export interface ClockState {
  quarter: Quarter;
  /** Tenths of a game-minute remaining. Integer, so the clock cannot drift. */
  tenths: number;
}

/** How a drive finished. `null` while the drive is still alive. */
export type DriveEnd = 'touchdown' | 'field-goal' | 'punt' | 'downs';

export interface PlayOutcome {
  /** State the *next* play starts from. */
  drive: DriveState;
  points: number;
  driveEnded: DriveEnd | null;
}

export interface KickOutcome extends PlayOutcome {
  /** How far the kick travelled, 1–65 yards. */
  distance: number;
}

/** Which side of midfield the field-position number belongs to. */
export type FieldMarker = 'own' | 'opponent' | 'none';

export interface FieldPosition {
  number: number;
  marker: FieldMarker;
}

/* ---- display ------------------------------------------------------------ */

export type Intensity = 'off' | 'dim' | 'bright';

/**
 * A single lit cell. The engine emits these; the renderer never learns which
 * blip is the runner — so Gridiron 2's ball and receivers render unchanged.
 */
export interface Blip {
  row: number;
  col: number;
  intensity: Intensity;
  blink: boolean;
}

export type BlipStyle = 'dash' | 'round';

/* ---- machine ------------------------------------------------------------ */

export type Skill = 'off' | 'pro1' | 'pro2';

export type Phase =
  | 'POWER_OFF'
  | 'PRESNAP'
  | 'PLAY'
  | 'TACKLED'
  | 'SCORE_TD'
  | 'KICK'
  | 'STATUS'
  | 'SCOREBOARD'
  | 'QUARTER_BREAK'
  | 'GAME_OVER';

export type Command =
  | 'forward'
  | 'up'
  | 'down'
  | 'status'
  | 'score'
  | 'kick'
  | 'skill-off'
  | 'skill-pro1'
  | 'skill-pro2'
  | 'mute'
  | 'blip-style';

/** What the display is currently showing in the numeric windows. */
export type Readout = 'status' | 'score';
