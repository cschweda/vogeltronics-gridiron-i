/**
 * The three numeric windows, as the 1977 unit drove them.
 *
 * ST: DOWN | FIELD POSITION | YARDS TO GO
 * SC: YOUR SCORE | TIME REMAINING | 0
 *
 * The tack mark is returned separately from the number so the cabinet can draw
 * it as an LED segment rather than a text glyph.
 */
import type { ClockState, DriveState, FieldMarker } from '../types';
import { clockLabel, fieldPosition, isGoalToGo } from '../engine/rules';

export interface ReadoutWindows {
  left: string;
  middle: string;
  right: string;
  /** Which side of the middle window the 50-yard tack sits on. */
  marker: FieldMarker;
}

export function statusReadout(drive: DriveState): ReadoutWindows {
  const position = fieldPosition(drive.ballOn);
  return {
    left: String(drive.down),
    middle: String(position.number),
    // Inside the 10 the yards-to-go window goes dark: the manual keys this to
    // distance-to-touchdown, not to the first-down marker.
    right: isGoalToGo(drive) ? '' : String(drive.toGo),
    marker: position.marker,
  };
}

export function scoreReadout(score: number, clock: ClockState): ReadoutWindows {
  return {
    left: String(score),
    middle: clockLabel(clock.tenths),
    // Solo play never fills the VISITOR window, but the unit still has three.
    right: '0',
    marker: 'none',
  };
}
