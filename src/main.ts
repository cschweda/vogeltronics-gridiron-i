/**
 * Bootstrap: wire input, audio and rendering to the fixed-timestep loop.
 *
 * This is the only module that touches the browser's clock or its event loop.
 * Everything under engine/ stays pure so it can be tested in Node — and, in
 * time, imported wholesale by Gridiron 2.
 */
import './styles.css';

import { TICK_MS, createLoop } from './engine/loop';
import { makeRng } from './engine/rng';
import { clockLabel, fieldPosition, isGoalToGo } from './engine/rules';
import {
  type Action,
  type GameState,
  initialState,
  reduce,
  toBlips,
} from './engine/state';
import { Sound } from './audio/sound';
import { bindButtons } from './input/buttons';
import { bindKeyboard } from './input/keyboard';
import { bindWheelZoom } from './input/wheel';
import {
  buildCabinet,
  flashKey,
  paintControls,
  paintField,
  paintLegend,
  paintReadout,
} from './render/cabinet';
import { toGrid } from './render/led';
import { scoreReadout, statusReadout } from './render/status';
import type { Command } from './types';

const mountEl = document.querySelector<HTMLElement>('#game');
const hintEl = document.querySelector<HTMLElement>('#hint');
if (!mountEl || !hintEl) throw new Error('Gridiron: missing mount point');
const mount: HTMLElement = mountEl;
const hint: HTMLElement = hintEl;

/** `?seed=` makes a game replayable; otherwise every session is its own. */
function pickSeed(): number {
  const raw = new URLSearchParams(window.location.search).get('seed');
  const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : Math.floor(Date.now() % 2147483647);
}

const rng = makeRng(pickSeed());
const sound = new Sound();
const cabinet = buildCabinet(mount);

let state = initialState();

/* ---- presentation -------------------------------------------------------- */

const ORDINAL = ['', '1st', '2nd', '3rd', '4th'];

/** A spoken-language version of what the LEDs are showing. */
function describe(s: GameState): string {
  if (s.phase === 'POWER_OFF') {
    const audio = s.muted ? ' Sound is off — press M to turn it on.' : '';
    return `Power off. Press 1 for PRO 1, or 2 for PRO 2, to start a game.${audio}`;
  }
  if (s.phase === 'GAME_OVER') return `Game over. Final score ${s.score}. Press 0, then 1 or 2, for a new game.`;

  // Once the whistle has blown, `drive` still describes the play that just
  // ended — what the player needs to hear is where the *next* one starts.
  const resolved = s.phase === 'TACKLED' || s.phase === 'SCORE_TD' || s.phase === 'KICK';
  const situationDrive = resolved ? s.pendingDrive : s.drive;

  const position = fieldPosition(situationDrive.ballOn);
  const where =
    position.marker === 'none'
      ? 'the 50'
      : position.marker === 'own'
        ? `your own ${position.number}`
        : `the opponent ${position.number}`;

  const toGo = isGoalToGo(situationDrive) ? 'goal' : String(situationDrive.toGo);
  const situation = `${ORDINAL[situationDrive.down]} and ${toGo} at ${where}`;
  const clock = `Q${s.clock.quarter}, ${clockLabel(s.clock.tenths)} left. Score ${s.score}.`;

  switch (s.phase) {
    case 'TACKLED':
      return `Tackled after ${s.lastGain} ${Math.abs(s.lastGain) === 1 ? 'yard' : 'yards'}. ${
        s.lastDriveEnd === 'downs' ? 'Turnover on downs. ' : ''
      }Press ST or SC. Now ${situation}. ${clock}`;
    case 'SCORE_TD':
      return `Touchdown! ${clock} Press ST or SC to continue.`;
    case 'KICK':
      return s.lastDriveEnd === 'field-goal'
        ? `Field goal is good — a ${s.lastKickDistance}-yard kick. ${clock} Press ST or SC. Now ${situation}.`
        : `Punt, ${s.lastKickDistance} yards. ${clock} Press ST or SC. Now ${situation}.`;
    case 'PLAY':
      return `${situation}. ${clock}`;
    default:
      return `${situation}. ${clock} Press a direction to snap.`;
  }
}

/** A dark display. Powering off kills the digits, not just the field. */
const BLANK_READOUT = { left: '', middle: '', right: '', marker: 'none' } as const;

function paint(): void {
  paintField(cabinet, toGrid(toBlips(state)), state.blipStyle);
  paintReadout(
    cabinet,
    state.phase === 'POWER_OFF'
      ? BLANK_READOUT
      : state.readout === 'score'
        ? scoreReadout(state.score, state.clock)
        : statusReadout(state.drive),
  );
  paintControls(cabinet, state.skill, state.muted, state.blipStyle, state.zoom);
  paintLegend(
    cabinet,
    state.readout,
    isGoalToGo(state.drive),
    state.phase !== 'POWER_OFF',
    fieldPosition(state.drive.ballOn).marker,
  );
  cabinet.root.dataset['phase'] = state.phase;

  const text = describe(state);
  if (cabinet.announcer.textContent !== text) cabinet.announcer.textContent = text;
  hint.textContent = text;
}

/* ---- the driving loop ---------------------------------------------------- */

function apply(action: Action): void {
  const result = reduce(state, action, rng);
  state = result.state;
  // Sync the mute flag BEFORE playing: sound defaults to off, and the very
  // first event (power-on) would otherwise sound before the flag caught up.
  sound.setMuted(state.muted);
  for (const event of result.events) sound.play(event);
  paint();
}

function onCommand(command: Command): void {
  // Any input is a user gesture, which is what unlocks Web Audio.
  sound.unlock();
  flashKey(cabinet, command);
  apply({ type: 'command', command });
}

bindKeyboard({
  onCommand,
  isBetweenGames: () => state.phase === 'POWER_OFF' || state.phase === 'GAME_OVER',
});
bindButtons(cabinet, { onCommand });
bindWheelZoom(cabinet.root, { onCommand, getZoom: () => state.zoom });

const loop = createLoop(TICK_MS, (deltaMs) => apply({ type: 'tick', deltaMs }));

function frame(now: number): void {
  loop.advance(now);
  window.requestAnimationFrame(frame);
}

window.requestAnimationFrame((now) => {
  loop.reset(now);
  window.requestAnimationFrame(frame);
});

sound.setMuted(state.muted);
paint();
