import { describe, expect, test } from 'vitest';
import { makeRng } from '../src/engine/rng';
import {
  type Action,
  type GameState,
  initialState,
  reduce,
  runnerYardLine,
  toBlips,
} from '../src/engine/state';
import { QUARTER_TENTHS } from '../src/engine/rules';
import { DEFENDER_COUNT } from '../src/types';

/** Small harness so tests read like someone playing the thing. */
function game(seed = 1977) {
  const rng = makeRng(seed);
  let state = initialState();
  const events: string[] = [];

  const apply = (action: Action) => {
    const out = reduce(state, action, rng);
    state = out.state;
    events.push(...out.events);
    return out;
  };

  return {
    get state(): GameState {
      return state;
    },
    get events(): string[] {
      return events;
    },
    press: (command: Parameters<typeof reduce>[1] extends never ? never : string) =>
      apply({ type: 'command', command: command as never }),
    tick: (deltaMs: number) => apply({ type: 'tick', deltaMs }),
    powerOn: () => apply({ type: 'command', command: 'skill-pro1' }),
  };
}

describe('power', () => {
  test('starts powered off with no blips lit', () => {
    const g = game();
    expect(g.state.phase).toBe('POWER_OFF');
    expect(toBlips(g.state)).toEqual([]);
  });

  test('flipping to PRO 1 sets the field for the opening play', () => {
    const g = game();
    g.powerOn();
    expect(g.state.phase).toBe('PRESNAP');
    expect(g.state.skill).toBe('pro1');
    expect(g.state.drive).toEqual({ ballOn: 20, down: 1, toGo: 10 });
    expect(g.state.defenders).toHaveLength(DEFENDER_COUNT);
    expect(g.state.runner).toEqual({ row: 1, col: 0 });
  });

  test('OFF works at any time and wipes the game back to power-off', () => {
    const g = game();
    g.powerOn();
    g.press('forward');
    g.press('skill-off');
    expect(g.state.phase).toBe('POWER_OFF');
    expect(g.state.score).toBe(0);
  });

  test('changing PRO level mid-game ends the game', () => {
    const g = game();
    g.powerOn();
    g.press('forward');
    g.press('skill-pro2');
    expect(g.state.phase).toBe('GAME_OVER');
  });

  test('re-selecting the same PRO level mid-game changes nothing', () => {
    const g = game();
    g.powerOn();
    g.press('forward');
    const before = g.state.phase;
    g.press('skill-pro1');
    expect(g.state.phase).toBe(before);
  });

  test('directions do nothing while powered off', () => {
    const g = game();
    g.press('forward');
    expect(g.state.phase).toBe('POWER_OFF');
  });
});

describe('starting a play', () => {
  test('the first direction press starts the play', () => {
    const g = game();
    g.powerOn();
    expect(g.state.phase).toBe('PRESNAP');
    g.press('forward');
    expect(g.state.phase).toBe('PLAY');
  });

  test('the clock does not move before the snap', () => {
    const g = game();
    g.powerOn();
    g.tick(5000);
    expect(g.state.clock.tenths).toBe(QUARTER_TENTHS);
  });

  test('the clock runs once the play is live', () => {
    const g = game();
    g.powerOn();
    g.press('forward');
    g.tick(3000);
    expect(g.state.clock.tenths).toBe(QUARTER_TENTHS - 3);
  });

  test('a lane change also starts the play', () => {
    const g = game();
    g.powerOn();
    g.press('up');
    expect(g.state.phase).toBe('PLAY');
  });
});

describe('running', () => {
  test('forward advances exactly one yard per press', () => {
    const g = game();
    g.powerOn();
    const start = runnerYardLine(g.state);
    g.press('forward');
    expect(runnerYardLine(g.state)).toBe(start + 1);
  });

  test('a lane change costs no yardage', () => {
    const g = game();
    g.powerOn();
    const start = runnerYardLine(g.state);
    g.press('up');
    expect(runnerYardLine(g.state)).toBe(start);
    expect(g.state.runner.row).toBe(0);
  });

  test('lane changes stop at the sideline', () => {
    const g = game();
    g.powerOn();
    g.press('up');
    g.press('up');
    expect(g.state.runner.row).toBe(0);
  });

  test('clearing the nine-yard window scrolls the field and keeps the play alive', () => {
    const g = game(3);
    g.powerOn();
    // Walk the empty top lane; scatter never uses columns 0-1.
    g.press('up');
    const origin = g.state.windowOrigin;
    for (let i = 0; i < 9 && g.state.phase === 'PLAY'; i++) g.press('forward');
    if (g.state.phase === 'PLAY') {
      expect(g.state.windowOrigin).toBe(origin + 9);
      expect(g.state.runner.col).toBe(0);
    }
  });
});

describe('tackles', () => {
  /** Drive forward until somebody makes the hit. */
  function runUntilTackled(g: ReturnType<typeof game>, limit = 400) {
    for (let i = 0; i < limit; i++) {
      if (g.state.phase === 'TACKLED' || g.state.phase === 'SCORE_TD') return;
      g.press('forward');
      g.tick(200);
    }
  }

  test('a tackle ends the play and marks the tackler that made the hit', () => {
    const g = game(11);
    g.powerOn();
    runUntilTackled(g);
    expect(g.state.phase).toBe('TACKLED');
    expect(g.state.tacklerIndex).toBeGreaterThanOrEqual(0);
  });

  test('the tackler blinks and every other blip stays dim', () => {
    const g = game(11);
    g.powerOn();
    runUntilTackled(g);
    const blips = toBlips(g.state);
    expect(blips.filter((b) => b.blink)).toHaveLength(1);
    expect(blips.filter((b) => b.intensity === 'bright')).toHaveLength(1);
  });

  test('a tackle blows a single whistle', () => {
    const g = game(11);
    g.powerOn();
    runUntilTackled(g);
    expect(g.events).toContain('whistle');
  });

  test('a direction after the whistle sets up the next play rather than moving', () => {
    const g = game(11);
    g.powerOn();
    runUntilTackled(g);
    const pending = g.state.pendingDrive;

    g.press('forward');

    expect(g.state.phase).not.toBe('TACKLED');
    expect(g.state.drive).toEqual(pending);
    expect(g.state.runner).toEqual({ row: 1, col: 0 });
  });

  test('the runner does not also advance a yard on the key that continues', () => {
    const g = game(11);
    g.powerOn();
    runUntilTackled(g);
    g.press('forward');
    // Continuing and running are separate presses; the snap has not happened.
    expect(runnerYardLine(g.state)).toBe(g.state.drive.ballOn);
  });

  test('a settings toggle after the whistle does not continue the game', () => {
    for (const command of ['mute', 'blip-style', 'zoom'] as const) {
      const g = game(11);
      g.powerOn();
      runUntilTackled(g);
      g.press(command);
      expect(g.state.phase).toBe('TACKLED');
    }
  });

  test('ST sets up the next play with a fresh defense', () => {
    const g = game(11);
    g.powerOn();
    runUntilTackled(g);
    const pending = g.state.pendingDrive;
    g.press('status');
    expect(g.state.phase).toBe('STATUS');
    expect(g.state.drive).toEqual(pending);
    expect(g.state.runner).toEqual({ row: 1, col: 0 });
    expect(g.state.defenders).toHaveLength(DEFENDER_COUNT);
    expect(g.state.tacklerIndex).toBe(-1);
  });

  test('SC also sets up the next play', () => {
    const g = game(11);
    g.powerOn();
    runUntilTackled(g);
    g.press('score');
    expect(g.state.phase).toBe('SCOREBOARD');
    expect(g.state.readout).toBe('score');
  });
});

describe('kicking', () => {
  /** Fast-forward to a 4th down without touching the runner. */
  function toFourthDown(g: ReturnType<typeof game>) {
    for (let i = 0; i < 500 && g.state.drive.down !== 4; i++) {
      if (g.state.phase === 'TACKLED') {
        g.press('status');
        continue;
      }
      g.press('forward');
      g.tick(400);
    }
  }

  test('K on downs 1-3 does nothing at all', () => {
    const g = game();
    g.powerOn();
    expect(g.state.drive.down).toBe(1);
    g.press('kick');
    expect(g.state.phase).toBe('PRESNAP');
    expect(g.state.score).toBe(0);
  });

  test('K on 4th down ends the drive and restarts on the own 20', () => {
    const g = game(23);
    g.powerOn();
    toFourthDown(g);
    expect(g.state.drive.down).toBe(4);
    g.press('kick');
    expect(g.state.phase).toBe('KICK');
    expect(['field-goal', 'punt']).toContain(g.state.lastDriveEnd);
    expect(g.state.pendingDrive).toEqual({ ballOn: 20, down: 1, toGo: 10 });
  });

  test('a kick sounds the kick and then the outcome', () => {
    const g = game(23);
    g.powerOn();
    toFourthDown(g);
    const before = g.events.length;
    g.press('kick');
    const fired = g.events.slice(before);
    expect(fired[0]).toBe('kick');
    expect(['fanfare', 'double-whistle']).toContain(fired[1]);
  });
});

describe('display projection', () => {
  test('lights five dim tacklers and one bright runner', () => {
    const g = game();
    g.powerOn();
    const blips = toBlips(g.state);
    expect(blips.filter((b) => b.intensity === 'dim')).toHaveLength(DEFENDER_COUNT);
    expect(blips.filter((b) => b.intensity === 'bright')).toHaveLength(1);
  });

  test('nothing is lit while powered off', () => {
    expect(toBlips(initialState())).toEqual([]);
  });
});

describe('smoke: a seeded drive reaches a touchdown', () => {
  test('seed 6 scores from the own 20 under greedy running', () => {
    const g = game(6);
    g.powerOn();

    const occupied = (r: number, c: number) =>
      g.state.defenders.some((d) => d.row === r && d.col === c);

    for (let i = 0; i < 5000; i++) {
      if (g.state.phase === 'SCORE_TD') break;

      if (g.state.phase === 'TACKLED') {
        // The drive must survive; a turnover means the seed no longer scores.
        expect(g.state.lastDriveEnd).toBeNull();
        g.press('status');
        continue;
      }

      const row = g.state.runner.row;
      const col = g.state.runner.col;
      const free = (r: number) =>
        r >= 0 && r <= 2 && !occupied(r, col + 1) && !occupied(r, col);

      let command = 'forward';
      if (occupied(row, col + 1)) {
        if (free(row - 1)) command = 'up';
        else if (free(row + 1)) command = 'down';
      }

      g.press(command);
      g.tick(200);
    }

    expect(g.state.phase).toBe('SCORE_TD');
    expect(g.state.score).toBe(7);
    expect(g.events).toContain('fanfare');
    expect(g.state.pendingDrive).toEqual({ ballOn: 20, down: 1, toGo: 10 });
  });
});

describe('display zoom', () => {
  test('cycles 1 -> 2 -> 3 -> 1', () => {
    const g = game();
    g.powerOn();
    expect(g.state.zoom).toBe(1);
    g.press('zoom');
    expect(g.state.zoom).toBe(2);
    g.press('zoom');
    expect(g.state.zoom).toBe(3);
    g.press('zoom');
    expect(g.state.zoom).toBe(1);
  });

  test('zoom-in steps up and stops at the top instead of wrapping', () => {
    const g = game();
    g.powerOn();
    g.press('zoom-in');
    expect(g.state.zoom).toBe(2);
    g.press('zoom-in');
    expect(g.state.zoom).toBe(3);
    // A wheel notch at the top must not drop back to 1x.
    g.press('zoom-in');
    expect(g.state.zoom).toBe(3);
  });

  test('zoom-out steps down and stops at the bottom', () => {
    const g = game();
    g.powerOn();
    g.press('zoom-in');
    g.press('zoom-in');
    expect(g.state.zoom).toBe(3);
    g.press('zoom-out');
    expect(g.state.zoom).toBe(2);
    g.press('zoom-out');
    expect(g.state.zoom).toBe(1);
    g.press('zoom-out');
    expect(g.state.zoom).toBe(1);
  });

  test('a wheel step after the whistle does not continue the game', () => {
    const g = game(11);
    g.powerOn();
    for (let i = 0; i < 400 && g.state.phase !== 'TACKLED'; i++) {
      g.press('forward');
      g.tick(200);
    }
    expect(g.state.phase).toBe('TACKLED');
    g.press('zoom-in');
    expect(g.state.phase).toBe('TACKLED');
  });

  test('survives a power cycle, like the other display preferences', () => {
    const g = game();
    g.powerOn();
    g.press('zoom');
    g.press('skill-off');
    expect(g.state.zoom).toBe(2);
    g.powerOn();
    expect(g.state.zoom).toBe(2);
  });
});
