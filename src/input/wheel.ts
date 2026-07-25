/**
 * Mouse wheel over the cabinet steps the display zoom.
 *
 * Two rules make this safe rather than annoying:
 *
 * 1. It never traps the page. At 3x a further scroll-up, and at 1x a further
 *    scroll-down, are left alone — so the wheel always still scrolls the page
 *    once the zoom has nowhere left to go. Swallowing every wheel event over a
 *    large element is how sites become impossible to scroll past.
 * 2. Ctrl/Cmd + wheel is the browser's own page zoom, and an accessibility
 *    affordance. That is never intercepted.
 *
 * The wheel is an addition, not a replacement: Z and the on-screen control do
 * the same job for anyone without a wheel.
 */
import type { Command, ZoomLevel } from '../types';
import { MAX_ZOOM, MIN_ZOOM } from '../types';

/**
 * Accumulated deltaY needed for one zoom step. A mouse notch is usually ~100,
 * so one notch is one step; a trackpad emits many small deltas and has to add
 * up before anything moves.
 */
const STEP_THRESHOLD = 50;

/** Momentum scrolling keeps firing after the gesture; this stops it running away. */
const COOLDOWN_MS = 140;

export interface WheelZoomOptions {
  onCommand(command: Command): void;
  getZoom(): ZoomLevel;
}

export function bindWheelZoom(target: HTMLElement, options: WheelZoomOptions): () => void {
  let accumulated = 0;
  let lastStepAt = -Infinity;

  const handler = (event: WheelEvent): void => {
    if (event.ctrlKey || event.metaKey) return;
    if (event.deltaY === 0) return;

    const zoom = options.getZoom();
    const zoomingIn = event.deltaY < 0;

    if (zoomingIn && zoom >= MAX_ZOOM) return;
    if (!zoomingIn && zoom <= MIN_ZOOM) return;

    // Past this point the gesture belongs to the zoom, so keep the page still.
    event.preventDefault();

    // A reversal starts a fresh gesture rather than cancelling out the last one.
    if (accumulated !== 0 && Math.sign(event.deltaY) !== Math.sign(accumulated)) {
      accumulated = 0;
    }
    accumulated += event.deltaY;

    if (Math.abs(accumulated) < STEP_THRESHOLD) return;
    if (event.timeStamp - lastStepAt < COOLDOWN_MS) {
      accumulated = 0;
      return;
    }

    lastStepAt = event.timeStamp;
    const command: Command = accumulated < 0 ? 'zoom-in' : 'zoom-out';
    accumulated = 0;
    options.onCommand(command);
  };

  target.addEventListener('wheel', handler, { passive: false });
  return () => target.removeEventListener('wheel', handler);
}
