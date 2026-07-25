/**
 * The single GameState and the explicit state machine over it.
 *
 * `reduce` is pure: (state, action, rng) -> (state, events). Nothing here
 * touches the DOM, a timer, or `Math.random`. The renderer reads state; the
 * audio layer reads the emitted events.
 */
import type {
  BlipStyle,
  Blip,
  ClockState,
  Command,
  DriveEnd,
  DriveState,
  Phase,
  Readout,
  Skill,
  ZoomLevel,
} from '../types';
import { FIELD_COLS, FIELD_LENGTH, FIELD_ROWS } from '../types';
import type { Cell } from './defenders';
import { defenderIntervalMs, findTackler, scatterDefenders, stepDefenders } from './defenders';
import type { Rng } from './rng';
import {
  QUARTER_TENTHS,
  advanceQuarter,
  newDrive,
  resolveKick,
  resolveRun,
  tickClock,
} from './rules';

export type GameEvent =
  | 'step'
  | 'whistle'
  | 'double-whistle'
  | 'fanfare'
  | 'kick'
  | 'power-on'
  | 'power-off';

export interface GameState {
  phase: Phase;
  skill: Skill;
  drive: DriveState;
  clock: ClockState;
  score: number;

  /** Runner position within the visible 3x9 window. */
  runner: Cell;
  defenders: Cell[];
  /** Index of the tackler that made the hit, or -1. Drives the blink. */
  tacklerIndex: number;

  /** Absolute yard line that window column 0 currently represents. */
  windowOrigin: number;

  /** The drive state the next play will start from, once ST/SC is pressed. */
  pendingDrive: DriveState;
  /** How the drive just ended, if it did. */
  lastDriveEnd: DriveEnd | null;
  /** Yards gained on the play just completed. */
  lastGain: number;
  /** Distance of the kick just taken, if any. */
  lastKickDistance: number | null;
  /** The quarter clock ran out during the play that just finished. */
  quarterExpired: boolean;

  readout: Readout;
  muted: boolean;
  blipStyle: BlipStyle;
  zoom: ZoomLevel;

  /** Accumulators for the fixed-timestep loop. */
  defenderAccumMs: number;
  clockCarry: number;
}

export interface ReduceResult {
  state: GameState;
  events: GameEvent[];
}

export type Action =
  | { type: 'command'; command: Command }
  | { type: 'tick'; deltaMs: number };

const MIDDLE_ROW = Math.floor(FIELD_ROWS / 2);

/** Phases in which the field is set and we are waiting for the snap. */
const READY_PHASES: ReadonlySet<Phase> = new Set<Phase>([
  'PRESNAP',
  'STATUS',
  'SCOREBOARD',
]);

/** Phases in which the play is over and ST/SC must be pressed to continue. */
const RESOLVED_PHASES: ReadonlySet<Phase> = new Set<Phase>([
  'TACKLED',
  'SCORE_TD',
  'KICK',
  'QUARTER_BREAK',
]);

export function initialState(): GameState {
  return {
    phase: 'POWER_OFF',
    skill: 'off',
    drive: newDrive(),
    clock: { quarter: 1, tenths: QUARTER_TENTHS },
    score: 0,
    runner: { row: MIDDLE_ROW, col: 0 },
    defenders: [],
    tacklerIndex: -1,
    windowOrigin: newDrive().ballOn,
    pendingDrive: newDrive(),
    lastDriveEnd: null,
    lastGain: 0,
    lastKickDistance: null,
    quarterExpired: false,
    zoom: 1,
    readout: 'status',
    // The 1977 unit had no volume control and beeped from the moment you
    // switched it on. A web page that does that is rude, so sound starts off
    // and the player opts in. The toggle survives power cycles.
    muted: true,
    blipStyle: 'round',
    defenderAccumMs: 0,
    clockCarry: 0,
  };
}

/** Absolute yard line of the runner right now. */
export function runnerYardLine(state: GameState): number {
  return state.windowOrigin + state.runner.col;
}

/** Set the field for a play starting from `drive`. */
function setUpPlay(state: GameState, drive: DriveState, rng: Rng): GameState {
  return {
    ...state,
    drive,
    pendingDrive: drive,
    windowOrigin: drive.ballOn,
    runner: { row: MIDDLE_ROW, col: 0 },
    defenders: scatterDefenders(rng),
    tacklerIndex: -1,
    lastDriveEnd: null,
    lastKickDistance: null,
    defenderAccumMs: 0,
    clockCarry: 0,
  };
}

/** Start a brand new game at the given skill level. */
function startGame(state: GameState, skill: Skill, rng: Rng): GameState {
  const fresh = setUpPlay(
    {
      ...initialState(),
      muted: state.muted,
      blipStyle: state.blipStyle,
      zoom: state.zoom,
    },
    newDrive(),
    rng,
  );
  return { ...fresh, phase: 'PRESNAP', skill };
}

/** Fold a completed play into the score and stash what happens next. */
function completePlay(
  state: GameState,
  outcome: { drive: DriveState; points: number; driveEnded: DriveEnd | null },
  phase: Phase,
  tacklerIndex: number,
): GameState {
  return {
    ...state,
    phase,
    score: state.score + outcome.points,
    pendingDrive: outcome.drive,
    lastDriveEnd: outcome.driveEnded,
    tacklerIndex,
    quarterExpired: state.clock.tenths === 0,
  };
}

/** Sound a completed play: two whistles always mean drive over, no points. */
function playEndEvents(end: DriveEnd | null): GameEvent[] {
  switch (end) {
    case 'touchdown':
    case 'field-goal':
      return ['fanfare'];
    case 'punt':
    case 'downs':
      return ['double-whistle'];
    default:
      return ['whistle'];
  }
}

/** Resolve the runner being brought down (or crossing the goal). */
function resolveTackle(state: GameState, tacklerIndex: number): ReduceResult {
  const endYardLine = runnerYardLine(state);
  const outcome = resolveRun(state.drive, endYardLine);
  const scored = outcome.driveEnded === 'touchdown';
  const next = completePlay(
    { ...state, lastGain: endYardLine - state.drive.ballOn },
    outcome,
    scored ? 'SCORE_TD' : 'TACKLED',
    scored ? -1 : tacklerIndex,
  );
  return { state: next, events: playEndEvents(outcome.driveEnded) };
}

/** Move the runner one yard forward, scrolling or scoring as needed. */
function runForward(state: GameState, rng: Rng): ReduceResult {
  const nextCol = state.runner.col + 1;
  const absolute = state.windowOrigin + nextCol;

  if (absolute >= FIELD_LENGTH) {
    const scoredState: GameState = {
      ...state,
      runner: { ...state.runner, col: Math.min(nextCol, FIELD_COLS - 1) },
    };
    return resolveTackle(scoredState, -1);
  }

  // Cleared the 9-yard window: the field scrolls and fresh tacklers appear.
  const scrolled = nextCol >= FIELD_COLS;
  const moved: GameState = scrolled
    ? {
        ...state,
        windowOrigin: state.windowOrigin + FIELD_COLS,
        runner: { ...state.runner, col: 0 },
        defenders: scatterDefenders(rng),
      }
    : { ...state, runner: { ...state.runner, col: nextCol } };

  const hit = findTackler(moved.defenders, moved.runner);
  if (hit >= 0) return resolveTackle(moved, hit);

  return { state: moved, events: ['step'] };
}

/** Change lanes. Costs no yardage, but can still run you into a tackler. */
function changeLane(state: GameState, delta: number): ReduceResult {
  const row = Math.min(FIELD_ROWS - 1, Math.max(0, state.runner.row + delta));
  if (row === state.runner.row) return { state, events: [] };

  const moved: GameState = { ...state, runner: { ...state.runner, row } };
  const hit = findTackler(moved.defenders, moved.runner);
  if (hit >= 0) return resolveTackle(moved, hit);

  return { state: moved, events: ['step'] };
}

/** ST / SC: read out the numbers and set the field for the next play. */
function readoutAndAdvance(state: GameState, readout: Readout, rng: Rng): ReduceResult {
  if (!RESOLVED_PHASES.has(state.phase)) {
    // Between plays the key just swaps which numbers are showing.
    return { state: { ...state, readout }, events: [] };
  }

  if (state.quarterExpired) {
    const transition = advanceQuarter(state.clock, state.pendingDrive);
    if (transition.gameOver) {
      return {
        state: { ...state, phase: 'GAME_OVER', readout, quarterExpired: false },
        events: [],
      };
    }
    const next = setUpPlay(
      { ...state, clock: transition.clock, quarterExpired: false },
      transition.drive,
      rng,
    );
    return {
      state: { ...next, phase: readout === 'status' ? 'STATUS' : 'SCOREBOARD', readout },
      events: [],
    };
  }

  const next = setUpPlay(state, state.pendingDrive, rng);
  return {
    state: { ...next, phase: readout === 'status' ? 'STATUS' : 'SCOREBOARD', readout },
    events: [],
  };
}

function handleCommand(state: GameState, command: Command, rng: Rng): ReduceResult {
  // The power switch is live at all times, exactly like the physical flip.
  if (command === 'skill-off') {
    if (state.phase === 'POWER_OFF') return { state, events: [] };
    return {
      state: { ...initialState(), muted: state.muted, blipStyle: state.blipStyle, zoom: state.zoom },
      events: ['power-off'],
    };
  }

  if (command === 'skill-pro1' || command === 'skill-pro2') {
    const skill: Skill = command === 'skill-pro1' ? 'pro1' : 'pro2';
    const between = state.phase === 'POWER_OFF' || state.phase === 'GAME_OVER';

    if (between) return { state: startGame(state, skill, rng), events: ['power-on'] };
    if (skill === state.skill) return { state, events: [] };
    // Changing PRO level mid-game ends the game — the physical switch does this.
    return { state: { ...state, phase: 'GAME_OVER', skill }, events: ['power-off'] };
  }

  if (command === 'mute') {
    return { state: { ...state, muted: !state.muted }, events: [] };
  }

  if (command === 'zoom') {
    const next = ((state.zoom % 3) + 1) as ZoomLevel;
    return { state: { ...state, zoom: next }, events: [] };
  }

  if (command === 'blip-style') {
    return {
      state: { ...state, blipStyle: state.blipStyle === 'round' ? 'dash' : 'round' },
      events: [],
    };
  }

  if (state.phase === 'POWER_OFF' || state.phase === 'GAME_OVER') {
    return { state, events: [] };
  }

  if (command === 'status') return readoutAndAdvance(state, 'status', rng);
  if (command === 'score') return readoutAndAdvance(state, 'score', rng);

  const isPlayKey =
    command === 'forward' || command === 'up' || command === 'down' || command === 'kick';

  /*
   * After the whistle, ANY play key sets up the next down — not only ST/SC.
   * The 1977 unit needed that press because the readout was the only way to
   * learn the situation; here the state is already on screen, so demanding a
   * bookkeeping key before you may move again is pure friction. Mashing
   * forward is what a player actually does. ST and SC keep their meaning:
   * they also choose which numbers show.
   */
  if (isPlayKey && RESOLVED_PHASES.has(state.phase)) {
    return readoutAndAdvance(state, state.readout, rng);
  }

  if (command === 'kick') {
    // 4th down only, and only before the snap. Downs 1-3 do nothing at all.
    if (!READY_PHASES.has(state.phase)) return { state, events: [] };
    const outcome = resolveKick(state.drive, rng);
    if (!outcome) return { state, events: [] };
    const next = completePlay(
      { ...state, lastKickDistance: outcome.distance, lastGain: 0 },
      outcome,
      'KICK',
      -1,
    );
    return { state: next, events: ['kick', ...playEndEvents(outcome.driveEnded)] };
  }

  const isDirection = command === 'forward' || command === 'up' || command === 'down';
  if (!isDirection) return { state, events: [] };

  // The first direction press of a play starts the clock and the rush.
  const live = state.phase === 'PLAY';
  if (!live && !READY_PHASES.has(state.phase)) return { state, events: [] };

  const started: GameState = live
    ? state
    : { ...state, phase: 'PLAY', defenderAccumMs: 0, clockCarry: 0 };

  if (command === 'forward') return runForward(started, rng);
  return changeLane(started, command === 'up' ? -1 : 1);
}

function handleTick(state: GameState, deltaMs: number, rng: Rng): ReduceResult {
  if (state.phase !== 'PLAY') return { state, events: [] };

  // The clock only ever runs while the ball is live.
  const ticked = tickClock(state.clock.tenths, deltaMs / 1000, state.clockCarry);
  let next: GameState = {
    ...state,
    clock: { ...state.clock, tenths: ticked.tenths },
    clockCarry: ticked.carry,
    defenderAccumMs: state.defenderAccumMs + deltaMs,
  };

  const interval = defenderIntervalMs(next.skill);
  const events: GameEvent[] = [];

  while (next.defenderAccumMs >= interval) {
    next = {
      ...next,
      defenderAccumMs: next.defenderAccumMs - interval,
      defenders: stepDefenders(next.defenders, next.runner, rng),
    };

    const hit = findTackler(next.defenders, next.runner);
    if (hit >= 0) {
      const resolved = resolveTackle(next, hit);
      return { state: resolved.state, events: [...events, ...resolved.events] };
    }
  }

  return { state: next, events };
}

export function reduce(state: GameState, action: Action, rng: Rng): ReduceResult {
  return action.type === 'command'
    ? handleCommand(state, action.command, rng)
    : handleTick(state, action.deltaMs, rng);
}

/**
 * Project the state into a display-agnostic blip list.
 *
 * The renderer never learns which blip is the runner — so Gridiron 2's ball
 * in flight and receivers will render through this unchanged.
 */
export function toBlips(state: GameState): Blip[] {
  if (state.phase === 'POWER_OFF') return [];

  const blips: Blip[] = state.defenders.map((d, i) => ({
    row: d.row,
    col: d.col,
    intensity: 'dim' as const,
    blink: i === state.tacklerIndex,
  }));

  const showRunner = state.phase !== 'GAME_OVER';
  if (showRunner) {
    blips.push({
      row: state.runner.row,
      col: state.runner.col,
      intensity: 'bright',
      blink: false,
    });
  }

  return blips;
}
