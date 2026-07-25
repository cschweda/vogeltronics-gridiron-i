import { describe, expect, test } from 'vitest';
import { makeRng } from '../src/engine/rng';
import {
  QUARTER_TENTHS,
  advanceQuarter,
  clockLabel,
  fieldPosition,
  isGoalToGo,
  newDrive,
  resolveKick,
  resolveRun,
  tickClock,
  yardsToGoal,
} from '../src/engine/rules';

describe('drive setup', () => {
  test('a new drive is 1st & 10 on your own 20', () => {
    expect(newDrive()).toEqual({ ballOn: 20, down: 1, toGo: 10 });
  });
});

describe('downs and yardage', () => {
  test('a gain short of the sticks advances the down and shortens to-go', () => {
    const out = resolveRun({ ballOn: 20, down: 1, toGo: 10 }, 24);
    expect(out.drive).toEqual({ ballOn: 24, down: 2, toGo: 6 });
    expect(out.driveEnded).toBeNull();
    expect(out.points).toBe(0);
  });

  test('a gain that reaches the sticks resets to 1st & 10', () => {
    const out = resolveRun({ ballOn: 20, down: 2, toGo: 6 }, 26);
    expect(out.drive).toEqual({ ballOn: 26, down: 1, toGo: 10 });
    expect(out.driveEnded).toBeNull();
  });

  test('a gain past the sticks also resets to 1st & 10', () => {
    const out = resolveRun({ ballOn: 20, down: 3, toGo: 4 }, 31);
    expect(out.drive).toEqual({ ballOn: 31, down: 1, toGo: 10 });
  });

  test('no gain still burns a down', () => {
    const out = resolveRun({ ballOn: 40, down: 1, toGo: 10 }, 40);
    expect(out.drive).toEqual({ ballOn: 40, down: 2, toGo: 10 });
  });

  test('a new first down inside the 10 sets to-go to the goal line, not 10', () => {
    const out = resolveRun({ ballOn: 80, down: 1, toGo: 10 }, 94);
    expect(out.drive).toEqual({ ballOn: 94, down: 1, toGo: 6 });
  });
});

describe('turnover on downs', () => {
  test('failing to convert on 4th down ends the drive at your own 20', () => {
    const out = resolveRun({ ballOn: 45, down: 4, toGo: 3 }, 46);
    expect(out.driveEnded).toBe('downs');
    expect(out.points).toBe(0);
    expect(out.drive).toEqual({ ballOn: 20, down: 1, toGo: 10 });
  });

  test('converting on 4th down keeps the drive alive', () => {
    const out = resolveRun({ ballOn: 45, down: 4, toGo: 3 }, 49);
    expect(out.driveEnded).toBeNull();
    expect(out.drive).toEqual({ ballOn: 49, down: 1, toGo: 10 });
  });
});

describe('scoring', () => {
  test('reaching the goal line is a touchdown worth 7', () => {
    const out = resolveRun({ ballOn: 95, down: 2, toGo: 5 }, 100);
    expect(out.driveEnded).toBe('touchdown');
    expect(out.points).toBe(7);
  });

  test('a touchdown restarts the next drive on your own 20', () => {
    const out = resolveRun({ ballOn: 95, down: 2, toGo: 5 }, 100);
    expect(out.drive).toEqual({ ballOn: 20, down: 1, toGo: 10 });
  });
});

describe('kicking', () => {
  test('a kick on downs 1-3 is ignored entirely', () => {
    const rng = makeRng(1);
    for (const down of [1, 2, 3] as const) {
      expect(resolveKick({ ballOn: 70, down, toGo: 5 }, rng)).toBeNull();
    }
  });

  test('a kick that reaches the goal line is a made field goal worth 3', () => {
    // ballOn 70 => 30 yards to goal. Force a long kick by seeking a seed.
    const drive = { ballOn: 70, down: 4 as const, toGo: 5 };
    const out = resolveKick(drive, { ...makeRng(1), intBetween: () => 30 });
    expect(out).not.toBeNull();
    expect(out!.driveEnded).toBe('field-goal');
    expect(out!.points).toBe(3);
    expect(out!.distance).toBe(30);
  });

  test('a kick one yard short of the goal line is a punt worth nothing', () => {
    const drive = { ballOn: 70, down: 4 as const, toGo: 5 };
    const out = resolveKick(drive, { ...makeRng(1), intBetween: () => 29 });
    expect(out!.driveEnded).toBe('punt');
    expect(out!.points).toBe(0);
  });

  test('every kick outcome restarts the next drive on your own 20', () => {
    const drive = { ballOn: 70, down: 4 as const, toGo: 5 };
    const fg = resolveKick(drive, { ...makeRng(1), intBetween: () => 30 });
    const punt = resolveKick(drive, { ...makeRng(1), intBetween: () => 10 });
    expect(fg!.drive).toEqual({ ballOn: 20, down: 1, toGo: 10 });
    expect(punt!.drive).toEqual({ ballOn: 20, down: 1, toGo: 10 });
  });

  test('from beyond 65 yards out even a maximum kick is always a punt', () => {
    // own 20 => 80 yards to goal, further than the longest possible kick
    const drive = { ballOn: 20, down: 4 as const, toGo: 10 };
    const rng = makeRng(99);
    for (let i = 0; i < 200; i++) {
      const out = resolveKick(drive, rng);
      expect(out!.driveEnded).toBe('punt');
    }
  });

  test('kick distance stays within 1-65 across many seeded draws', () => {
    const rng = makeRng(1977);
    const drive = { ballOn: 50, down: 4 as const, toGo: 10 };
    for (let i = 0; i < 500; i++) {
      const out = resolveKick(drive, rng);
      expect(out!.distance).toBeGreaterThanOrEqual(1);
      expect(out!.distance).toBeLessThanOrEqual(65);
    }
  });
});

describe('goal to go', () => {
  test('is false outside 10 yards from the goal', () => {
    expect(isGoalToGo({ ballOn: 90, down: 1, toGo: 10 })).toBe(false);
  });

  test('is true inside 10 yards from the goal', () => {
    expect(isGoalToGo({ ballOn: 91, down: 1, toGo: 9 })).toBe(true);
  });

  test('yardsToGoal counts from the ball to the opponent goal line', () => {
    expect(yardsToGoal({ ballOn: 20, down: 1, toGo: 10 })).toBe(80);
    expect(yardsToGoal({ ballOn: 96, down: 1, toGo: 4 })).toBe(4);
  });
});

describe('field position display', () => {
  test('your own side of the 50 puts the tack mark on the right', () => {
    expect(fieldPosition(42)).toEqual({ number: 42, marker: 'own' });
  });

  test('the opponent side of the 50 counts down and flips the tack mark', () => {
    expect(fieldPosition(60)).toEqual({ number: 40, marker: 'opponent' });
  });

  test('midfield shows no marker at all', () => {
    expect(fieldPosition(50)).toEqual({ number: 50, marker: 'none' });
  });
});

describe('clock', () => {
  test('a quarter starts at 15.0 game-minutes', () => {
    expect(QUARTER_TENTHS).toBe(150);
    expect(clockLabel(150)).toBe('15.0');
  });

  test('renders half-minutes as a decimal', () => {
    expect(clockLabel(75)).toBe('7.5');
  });

  test('shows 0.0 at the end of a quarter', () => {
    expect(clockLabel(0)).toBe('0.0');
  });

  test('drops one tenth of a game-minute per real second', () => {
    expect(tickClock(150, 1).tenths).toBe(149);
    expect(tickClock(150, 10).tenths).toBe(140);
  });

  test('never ticks below zero', () => {
    expect(tickClock(3, 60).tenths).toBe(0);
  });

  test('a sub-tenth frame banks the remainder instead of losing it', () => {
    // A single 60fps frame is far under one tenth: the clock must not move,
    // but the time must not evaporate either.
    const step = tickClock(150, 0.016);
    expect(step.tenths).toBe(150);
    expect(step.carry).toBeCloseTo(0.016, 6);
  });

  test('carried remainders accumulate into whole tenths', () => {
    let tenths = 150;
    let carry = 0;
    // 600 quarter-second frames = 150 real seconds = a full quarter
    for (let i = 0; i < 600; i++) {
      ({ tenths, carry } = tickClock(tenths, 0.25, carry));
    }
    expect(tenths).toBe(0);
    expect(Number.isInteger(tenths)).toBe(true);
  });

  test('runs the clock down through exactly one quarter of live ball', () => {
    let tenths = QUARTER_TENTHS;
    let carry = 0;
    // 150 real seconds at 60fps
    for (let i = 0; i < 60 * 150; i++) {
      ({ tenths, carry } = tickClock(tenths, 1 / 60, carry));
    }
    expect(tenths).toBe(0);
  });
});

describe('quarter transitions', () => {
  const midDrive = { ballOn: 63, down: 3 as const, toGo: 4 };

  test('into Q2 the field position, down and to-go all carry over', () => {
    const out = advanceQuarter({ quarter: 1, tenths: 0 }, midDrive);
    expect(out.clock).toEqual({ quarter: 2, tenths: QUARTER_TENTHS });
    expect(out.drive).toEqual(midDrive);
    expect(out.gameOver).toBe(false);
  });

  test('halftime resets to a fresh 1st & 10 on your own 20', () => {
    const out = advanceQuarter({ quarter: 2, tenths: 0 }, midDrive);
    expect(out.clock).toEqual({ quarter: 3, tenths: QUARTER_TENTHS });
    expect(out.drive).toEqual({ ballOn: 20, down: 1, toGo: 10 });
  });

  test('into Q4 the drive carries over again', () => {
    const out = advanceQuarter({ quarter: 3, tenths: 0 }, midDrive);
    expect(out.clock).toEqual({ quarter: 4, tenths: QUARTER_TENTHS });
    expect(out.drive).toEqual(midDrive);
  });

  test('the game ends when the 4th quarter expires', () => {
    const out = advanceQuarter({ quarter: 4, tenths: 0 }, midDrive);
    expect(out.gameOver).toBe(true);
  });
});
