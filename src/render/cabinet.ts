/**
 * The VogelTronics Gridiron cabinet.
 *
 * Original industrial design — a wholly VogelTronics body, not a copy of any
 * real unit's silhouette, grille or faceplate layout. Period practice: Coleco
 * and Entex shipped their own football handhelds too. Same game, own hardware.
 *
 * Structure: the LED window is SVG (blips and true seven-segment digits, so it
 * stays crisp at any size); the shell and the keys are HTML, so the keys are
 * real focusable buttons. That matters — the spec reserves Tab for focus
 * navigation, which only means anything if the controls are properly focusable.
 */
import type { BlipStyle, Command, FieldMarker, Readout, Skill, ZoomLevel } from '../types';
import { FIELD_COLS, FIELD_ROWS } from '../types';
import type { LedCell } from './led';
import type { ReadoutWindows } from './status';

const SVG_NS = 'http://www.w3.org/2000/svg';

/* ---- seven-segment digits ------------------------------------------------ */

const DIGIT_W = 34;
const DIGIT_H = 58;
const SEG_T = 6;

/** Which segments each character lights. */
const SEGMENTS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abged',
  '3': 'abgcd',
  '4': 'fgbc',
  '5': 'afgcd',
  '6': 'afgecd',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
};

/** Segment geometry inside one digit box. */
const SEG_RECTS: Record<string, [number, number, number, number]> = {
  a: [SEG_T, 0, DIGIT_W - SEG_T * 2, SEG_T],
  b: [DIGIT_W - SEG_T, SEG_T, SEG_T, DIGIT_H / 2 - SEG_T],
  c: [DIGIT_W - SEG_T, DIGIT_H / 2, SEG_T, DIGIT_H / 2 - SEG_T],
  d: [SEG_T, DIGIT_H - SEG_T, DIGIT_W - SEG_T * 2, SEG_T],
  e: [0, DIGIT_H / 2, SEG_T, DIGIT_H / 2 - SEG_T],
  f: [0, SEG_T, SEG_T, DIGIT_H / 2 - SEG_T],
  g: [SEG_T, DIGIT_H / 2 - SEG_T / 2, DIGIT_W - SEG_T * 2, SEG_T],
};

function el<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

interface Digit {
  segments: Map<string, SVGRectElement>;
}

function buildDigit(parent: SVGGElement, x: number, y: number): Digit {
  const group = el('g', { transform: `translate(${x} ${y})` });
  const segments = new Map<string, SVGRectElement>();

  for (const [name, [rx, ry, rw, rh]] of Object.entries(SEG_RECTS)) {
    const rect = el('rect', {
      x: rx,
      y: ry,
      width: rw,
      height: rh,
      rx: 1.5,
      class: 'seg',
    });
    segments.set(name, rect);
    group.appendChild(rect);
  }

  parent.appendChild(group);
  return { segments };
}

function setDigit(digit: Digit, char: string): void {
  const lit = SEGMENTS[char] ?? '';
  for (const [name, rect] of digit.segments) {
    rect.toggleAttribute('data-on', lit.includes(name));
  }
}

/** Right-align a string into a fixed number of digit slots. */
function padSlots(value: string, slots: number): string[] {
  const chars = value.replace('.', '').split('');
  const out = new Array<string>(slots).fill('');
  for (let i = 0; i < Math.min(chars.length, slots); i++) {
    out[slots - 1 - i] = chars[chars.length - 1 - i]!;
  }
  return out;
}

/* ---- the display window -------------------------------------------------- */

interface DisplayHandles {
  svg: SVGSVGElement;
  blips: { round: SVGCircleElement; dash: SVGRectElement }[][];
  left: Digit[];
  middle: Digit[];
  right: Digit[];
  decimal: SVGCircleElement;
  tackOwn: SVGGElement;
  tackOpponent: SVGGElement;
}

const WIN_W = 720;
const WIN_H = 340;

function buildDisplay(): DisplayHandles {
  const svg = el('svg', {
    viewBox: `0 0 ${WIN_W} ${WIN_H}`,
    class: 'led-window',
    role: 'img',
    'aria-hidden': 'true',
  });

  svg.appendChild(el('rect', { x: 0, y: 0, width: WIN_W, height: WIN_H, rx: 18, class: 'led-glass' }));

  /* numeric windows across the top */
  const digitsRow = el('g', { transform: 'translate(0 34)' });
  svg.appendChild(digitsRow);

  const left: Digit[] = [];
  const middle: Digit[] = [];
  const right: Digit[] = [];

  // left window: two digits
  left.push(buildDigit(digitsRow, 78, 0));
  left.push(buildDigit(digitsRow, 78 + DIGIT_W + 10, 0));

  // middle window: three digits plus a decimal point
  const midX = 268;
  for (let i = 0; i < 3; i++) middle.push(buildDigit(digitsRow, midX + i * (DIGIT_W + 10), 0));

  const decimal = el('circle', {
    cx: midX + 2 * (DIGIT_W + 10) - 7,
    cy: DIGIT_H - 3,
    r: 4.5,
    class: 'seg',
  });
  digitsRow.appendChild(decimal);

  /*
   * The 50-yard line, as LED segments. The number sits on the ball's side of
   * it: `22⊣` is your own 22, `⊢22` is theirs.
   *
   * The arms have to be long relative to the bar or the three segments blur
   * into a single block at display size and read as a meaningless bar — which
   * is exactly what happened at 12px. The bracket has to be legible as a
   * bracket for the convention to survive at all.
   */
  const ARM = 20;
  const TACK_TOP = 6;
  const TACK_H = DIGIT_H - 12;

  /** `dir` is which way the arms reach: -1 wraps the number to the left (⊣). */
  function buildTack(barX: number, dir: -1 | 1): SVGGElement {
    const group = el('g', { class: 'tack' });
    const armX = dir === -1 ? barX - ARM : barX + SEG_T;

    group.appendChild(el('rect', { x: barX, y: TACK_TOP, width: SEG_T, height: TACK_H, rx: 2, class: 'seg' }));
    group.appendChild(el('rect', { x: armX, y: TACK_TOP, width: ARM, height: SEG_T, rx: 2, class: 'seg' }));
    group.appendChild(el('rect', { x: armX, y: TACK_TOP + TACK_H - SEG_T, width: ARM, height: SEG_T, rx: 2, class: 'seg' }));

    // Not announced (the svg is aria-hidden; the live region narrates instead),
    // but it still gives a hover tooltip to anyone wondering what the bar is.
    const title = el('title');
    title.textContent = 'The 50-yard line — the number sits on the ball’s side of it';
    group.appendChild(title);

    digitsRow.appendChild(group);
    return group;
  }

  /*
   * Anchor the tacks to where the digits actually end, with a clear gap.
   * Hand-tuned offsets had the arms drawn straight over the last digit, so the
   * digit and the bracket fused into one wide shape — which is why it read as
   * an unexplained bar rather than a marker beside a number.
   */
  const midDigitsLeft = midX;
  const midDigitsRight = midX + 2 * (DIGIT_W + 10) + DIGIT_W;
  const TACK_GAP = 10;

  const tackOwn = buildTack(midDigitsRight + TACK_GAP + ARM, -1);
  const tackOpponent = buildTack(midDigitsLeft - TACK_GAP - ARM - SEG_T, 1);

  // right window: two digits
  right.push(buildDigit(digitsRow, 540, 0));
  right.push(buildDigit(digitsRow, 540 + DIGIT_W + 10, 0));

  /* the playing field */
  const fieldTop = 150;
  const fieldLeft = 62;
  const gapX = (WIN_W - fieldLeft * 2) / (FIELD_COLS - 1);
  const gapY = 62;

  const fieldGroup = el('g');
  svg.appendChild(fieldGroup);

  const blips: DisplayHandles['blips'] = [];
  for (let row = 0; row < FIELD_ROWS; row++) {
    const rowBlips: DisplayHandles['blips'][number] = [];
    for (let col = 0; col < FIELD_COLS; col++) {
      const cx = fieldLeft + col * gapX;
      const cy = fieldTop + row * gapY;
      const round = el('circle', { cx, cy, r: 11, class: 'blip blip-round' });
      const dash = el('rect', { x: cx - 14, y: cy - 5, width: 28, height: 10, rx: 3, class: 'blip blip-dash' });
      fieldGroup.appendChild(round);
      fieldGroup.appendChild(dash);
      rowBlips.push({ round, dash });
    }
    blips.push(rowBlips);
  }

  return { svg, blips, left, middle, right, decimal, tackOwn, tackOpponent };
}

/* ---- keys ---------------------------------------------------------------- */

export interface KeySpec {
  command: Command;
  label: string;
  ariaLabel: string;
  /** Physical keys that light this on-screen key up. */
  keyHint: string;
  className: string;
}

export const KEYS: readonly KeySpec[] = [
  { command: 'status', label: 'ST', ariaLabel: 'Status — down, field position, yards to go (T)', keyHint: 'T', className: 'key-fn' },
  { command: 'score', label: 'SC', ariaLabel: 'Score — your score and time remaining (C)', keyHint: 'C', className: 'key-fn' },
  { command: 'kick', label: 'K', ariaLabel: 'Kick — fourth down only (K or Space)', keyHint: 'K', className: 'key-fn' },
  { command: 'up', label: '▲', ariaLabel: 'Move up a lane (W or arrow up)', keyHint: 'W', className: 'key-dir key-up' },
  { command: 'down', label: '▼', ariaLabel: 'Move down a lane (S or arrow down)', keyHint: 'S', className: 'key-dir key-down' },
  { command: 'forward', label: '◄▶', ariaLabel: 'Run toward the goal (D or arrow right)', keyHint: 'D', className: 'key-dir key-forward' },
];

export interface CabinetHandles {
  root: HTMLElement;
  display: DisplayHandles;
  keyButtons: Map<Command, HTMLButtonElement>;
  switchButtons: Map<Skill, HTMLButtonElement>;
  muteButton: HTMLButtonElement;
  blipButton: HTMLButtonElement;
  zoomButton: HTMLButtonElement;
  announcer: HTMLElement;
  /** The three window labels under the display. */
  legendCells: HTMLElement[];
}

function button(className: string, label: string, ariaLabel: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.textContent = label;
  b.setAttribute('aria-label', ariaLabel);
  return b;
}

export function buildCabinet(mount: HTMLElement): CabinetHandles {
  mount.innerHTML = '';

  const root = document.createElement('div');
  root.className = 'cabinet';

  /* top plate: maker mark */
  const topPlate = document.createElement('div');
  topPlate.className = 'plate plate-top';
  topPlate.innerHTML = `
    <img class="maker-mark" src="./vogeltronics-logo.svg" alt="VogelTronics" />
    <p class="tagline">Games That Think!</p>
  `;
  root.appendChild(topPlate);

  /* the display */
  const bezel = document.createElement('div');
  bezel.className = 'bezel';

  /*
   * The 1977 cabinet had these silkscreened on, so they never changed — which
   * means the same three windows read as DOWN/POSITION/TO-GO whether you had
   * pressed ST or SC. On a screen we can do better: the legend follows the
   * readout, so a number is never ambiguous.
   *
   * It sits ABOVE the window, directly over the digits it names. Below, the
   * whole nine-yard blip field came between a label and its number, which is
   * a long way to ask an eye to travel to pair two things up.
   */
  const legend = document.createElement('div');
  legend.className = 'window-legend';
  const legendCells: HTMLElement[] = [];
  for (let i = 0; i < 3; i++) {
    const span = document.createElement('span');
    legendCells.push(span);
    legend.appendChild(span);
  }
  bezel.appendChild(legend);

  const display = buildDisplay();
  bezel.appendChild(display.svg);
  root.appendChild(bezel);

  /* model badge band */
  const band = document.createElement('div');
  band.className = 'band';
  band.innerHTML = `
    <h1 class="model-badge">GRIDIRON</h1>
    <p class="model-sub">ELECTRONIC FOOTBALL</p>
    <p class="model-no">NO. 2100 · 1977</p>
  `;
  root.appendChild(band);

  /* control deck */
  const deck = document.createElement('div');
  deck.className = 'deck';

  const keyButtons = new Map<Command, HTMLButtonElement>();

  const fnCluster = document.createElement('div');
  fnCluster.className = 'cluster cluster-fn';
  const dirCluster = document.createElement('div');
  dirCluster.className = 'cluster cluster-dir';

  for (const spec of KEYS) {
    const b = button(`key ${spec.className}`, spec.label, spec.ariaLabel);
    b.dataset['command'] = spec.command;
    keyButtons.set(spec.command, b);
    (spec.className.startsWith('key-dir') ? dirCluster : fnCluster).appendChild(b);
  }

  deck.appendChild(fnCluster);
  deck.appendChild(dirCluster);
  root.appendChild(deck);

  /* switch row */
  const switchRow = document.createElement('div');
  switchRow.className = 'switch-row';

  const slide = document.createElement('div');
  slide.className = 'slide-switch';
  slide.setAttribute('role', 'group');
  slide.setAttribute('aria-label', 'Power and skill level');

  const switchButtons = new Map<Skill, HTMLButtonElement>();
  const switchSpecs: [Skill, string, string][] = [
    ['off', 'OFF', 'Power off — key 0'],
    ['pro1', 'PRO 1', 'Pro 1, normal defense — key 1'],
    ['pro2', 'PRO 2', 'Pro 2, defense reacts 50% faster — key 2'],
  ];
  for (const [skill, label, aria] of switchSpecs) {
    const b = button('switch-pos', label, aria);
    b.dataset['skill'] = skill;
    b.setAttribute('aria-pressed', 'false');
    switchButtons.set(skill, b);
    slide.appendChild(b);
  }
  switchRow.appendChild(slide);

  const toggles = document.createElement('div');
  toggles.className = 'toggles';
  // `aria-pressed` tracks sound being ON, not muted — "pressed = silenced"
  // reads backwards to anyone using a screen reader.
  const muteButton = button('toggle toggle-sound', '♪', 'Sound off. Turn sound on (M)');
  muteButton.setAttribute('aria-pressed', 'false');
  const blipButton = button('toggle', '●', 'Blip style, round or dash (B)');
  blipButton.setAttribute('aria-pressed', 'false');
  // Not a pressed/unpressed toggle — it steps through sizes, so it reports the
  // level rather than claiming an on/off state it does not have.
  const zoomButton = button('toggle toggle-zoom', '1x', 'Display size, 1x. Press to enlarge (Z)');
  toggles.appendChild(muteButton);
  toggles.appendChild(blipButton);
  toggles.appendChild(zoomButton);
  switchRow.appendChild(toggles);

  root.appendChild(switchRow);

  /* bottom moulding */
  const foot = document.createElement('p');
  foot.className = 'moulding';
  foot.textContent = 'VOGELTRONICS · ELK GROVE VILLAGE, ILL.';
  root.appendChild(foot);

  /* screen-reader running commentary — the LEDs alone say nothing out loud */
  const announcer = document.createElement('p');
  announcer.className = 'sr-only';
  announcer.setAttribute('role', 'status');
  announcer.setAttribute('aria-live', 'polite');
  root.appendChild(announcer);

  mount.appendChild(root);

  return {
    root,
    display,
    keyButtons,
    switchButtons,
    muteButton,
    blipButton,
    zoomButton,
    announcer,
    legendCells,
  };
}

/**
 * Label the three windows for whatever they are currently showing.
 *
 * The middle label also names which half of the field you are on. The tack
 * mark encodes that — the number sits on the ball's side of the 50 — but that
 * is a 1977 convention the manual used to explain, and a player who has not
 * read the manual just sees an unexplained bar. Naming the half decodes the
 * glyph without printing the number twice.
 */
export function paintLegend(
  handles: CabinetHandles,
  readout: Readout,
  goalToGo: boolean,
  powered: boolean,
  marker: FieldMarker = 'none',
): void {
  const half =
    marker === 'own' ? 'YOUR HALF' : marker === 'opponent' ? 'THEIR HALF' : 'MIDFIELD';

  const labels: [string, string, string] = !powered
    ? ['', '', '']
    : readout === 'score'
      ? ['YOUR SCORE', 'TIME LEFT', 'VISITOR']
      : ['DOWN', `POSITION · ${half}`, goalToGo ? 'GOAL TO GO' : 'TO GO'];

  handles.legendCells.forEach((cell, i) => {
    const text = labels[i] ?? '';
    if (cell.textContent !== text) cell.textContent = text;
  });
  handles.legendCells[2]?.toggleAttribute('data-emphasis', powered && goalToGo && readout === 'status');
}

/* ---- painting ------------------------------------------------------------ */

export function paintField(
  handles: CabinetHandles,
  grid: readonly (readonly LedCell[])[],
  style: BlipStyle,
): void {
  handles.display.svg.setAttribute('data-blip-style', style);

  for (let row = 0; row < FIELD_ROWS; row++) {
    for (let col = 0; col < FIELD_COLS; col++) {
      const cell = grid[row]?.[col];
      const target = handles.display.blips[row]![col]!;
      const intensity = cell?.intensity ?? 'off';
      const blink = cell?.blink ?? false;

      for (const shape of [target.round, target.dash]) {
        shape.setAttribute('data-intensity', intensity);
        shape.toggleAttribute('data-blink', blink);
      }
    }
  }
}

export function paintReadout(handles: CabinetHandles, windows: ReadoutWindows): void {
  const { display } = handles;

  const leftChars = padSlots(windows.left, 2);
  display.left.forEach((d, i) => setDigit(d, leftChars[i] ?? ''));

  const middleChars = padSlots(windows.middle, 3);
  display.middle.forEach((d, i) => setDigit(d, middleChars[i] ?? ''));

  const rightChars = padSlots(windows.right, 2);
  display.right.forEach((d, i) => setDigit(d, rightChars[i] ?? ''));

  display.decimal.toggleAttribute('data-on', windows.middle.includes('.'));
  setMarker(display, windows.marker);
}

function setMarker(display: DisplayHandles, marker: FieldMarker): void {
  display.tackOwn.toggleAttribute('data-on', marker === 'own');
  display.tackOpponent.toggleAttribute('data-on', marker === 'opponent');
}

export function paintControls(
  handles: CabinetHandles,
  skill: Skill,
  muted: boolean,
  blipStyle: BlipStyle,
  zoom: ZoomLevel = 1,
): void {
  for (const [pos, b] of handles.switchButtons) {
    b.setAttribute('aria-pressed', String(pos === skill));
    b.toggleAttribute('data-active', pos === skill);
  }
  const soundOn = !muted;
  handles.muteButton.setAttribute('aria-pressed', String(soundOn));
  handles.muteButton.setAttribute(
    'aria-label',
    soundOn ? 'Sound on. Turn sound off (M)' : 'Sound off. Turn sound on (M)',
  );
  handles.blipButton.setAttribute('aria-pressed', String(blipStyle === 'dash'));
  handles.zoomButton.textContent = `${zoom}x`;
  handles.zoomButton.setAttribute('aria-label', `Display size, ${zoom}x. Press to enlarge (Z)`);
  handles.root.dataset['zoom'] = String(zoom);
  handles.blipButton.textContent = blipStyle === 'dash' ? '▬' : '●';
}

/** Flash an on-screen key when its physical counterpart is pressed. */
export function flashKey(handles: CabinetHandles, command: Command): void {
  const b = handles.keyButtons.get(command);
  if (!b) return;
  b.setAttribute('data-pressed', '');
  window.setTimeout(() => b.removeAttribute('data-pressed'), 90);
}
