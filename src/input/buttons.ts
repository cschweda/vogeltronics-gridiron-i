/**
 * On-screen keys -> command enum.
 *
 * These are real <button> elements so they stay focusable and announce
 * themselves, but they behave like hardware: they fire on pointerdown rather
 * than click, and they blur on pointerup so a later Space press can never
 * re-trigger the last key you touched.
 */
import type { Command, Skill } from '../types';
import type { CabinetHandles } from '../render/cabinet';

export interface ButtonOptions {
  onCommand(command: Command): void;
}

/** Wire one button to fire on press, without double-firing for keyboard users. */
function wire(button: HTMLButtonElement, fire: () => void): void {
  let firedByPointer = false;

  button.addEventListener('pointerdown', (event) => {
    // Only the primary button, and never a secondary/context press.
    if (event.button !== 0) return;
    event.preventDefault();
    firedByPointer = true;
    fire();
  });

  button.addEventListener('pointerup', () => {
    button.blur();
  });

  button.addEventListener('pointercancel', () => {
    firedByPointer = false;
  });

  // Keyboard activation (Enter/Space on a focused button) arrives as a click
  // with no preceding pointerdown.
  button.addEventListener('click', () => {
    if (firedByPointer) {
      firedByPointer = false;
      return;
    }
    fire();
  });
}

export function bindButtons(handles: CabinetHandles, options: ButtonOptions): void {
  for (const [command, button] of handles.keyButtons) {
    wire(button, () => options.onCommand(command));
  }

  const skillCommand: Record<Skill, Command> = {
    off: 'skill-off',
    pro1: 'skill-pro1',
    pro2: 'skill-pro2',
  };

  // The slide switch is always live from the pointer — a deliberate action,
  // exactly like reaching over and flipping the physical switch mid-game.
  for (const [skill, button] of handles.switchButtons) {
    wire(button, () => options.onCommand(skillCommand[skill]));
  }

  wire(handles.muteButton, () => options.onCommand('mute'));
  wire(handles.blipButton, () => options.onCommand('blip-style'));
  wire(handles.zoomButton, () => options.onCommand('zoom'));
}
