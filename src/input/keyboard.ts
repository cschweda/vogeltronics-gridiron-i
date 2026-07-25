/**
 * Physical keyboard -> command enum.
 *
 * Keyboard-first is the headline rule: everything in the game is reachable
 * from here, and the on-screen keys only mirror this. Tab is never bound —
 * it stays reserved for focus navigation.
 */
import type { Command } from '../types';

/** Keys that work at any time. `0` is the deliberate abort / new-game path. */
const ALWAYS: Record<string, Command> = {
  d: 'forward',
  arrowright: 'forward',
  w: 'up',
  arrowup: 'up',
  s: 'down',
  arrowdown: 'down',
  t: 'status',
  c: 'score',
  k: 'kick',
  ' ': 'kick',
  m: 'mute',
  b: 'blip-style',
  z: 'zoom',
  '0': 'skill-off',
};

/**
 * PRO levels are gated to between games. On QWERTY 1 and 2 sit directly above
 * W, and a stray reach for W must never flip difficulty — which would end the
 * game — in the middle of a drive.
 */
const BETWEEN_GAMES_ONLY: Record<string, Command> = {
  '1': 'skill-pro1',
  '2': 'skill-pro2',
};

/** Keys we swallow so the page never scrolls out from under the game. */
const SCROLL_KEYS = new Set([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);

export interface KeyboardOptions {
  onCommand(command: Command): void;
  /** Whether PRO 1 / PRO 2 may currently be selected from the keyboard. */
  isBetweenGames(): boolean;
}

export function bindKeyboard(options: KeyboardOptions): () => void {
  const handler = (event: KeyboardEvent): void => {
    // One yard needs one physical press: OS auto-repeat must never auto-run.
    if (event.repeat) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    const key = event.key.toLowerCase();

    // A focused on-screen key owns Space and Enter — otherwise tabbing to ST
    // and pressing Space would fire both that button and the global kick.
    const active = document.activeElement;
    if ((key === ' ' || key === 'enter') && active instanceof HTMLButtonElement) return;

    const command = ALWAYS[key] ?? (options.isBetweenGames() ? BETWEEN_GAMES_ONLY[key] : undefined);
    if (!command) return;

    if (SCROLL_KEYS.has(key)) event.preventDefault();
    options.onCommand(command);
  };

  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}
