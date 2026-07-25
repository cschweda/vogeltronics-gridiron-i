/**
 * All sound is synthesised: oscillators and gain envelopes only, no files.
 *
 * The scoring fanfare is an ORIGINAL bugle-style riff built on the natural
 * harmonic series. It is deliberately not the stadium "Charge!" melody — that
 * carries a real composition claim — nor any other existing tune.
 */
import type { GameEvent } from '../engine/state';

type Wave = OscillatorType;

interface Note {
  freq: number;
  /** Seconds from the start of the phrase. */
  at: number;
  duration: number;
  gain?: number;
  wave?: Wave;
}

/** Bugle notes: the harmonic series a valveless horn can actually play. */
const G4 = 392.0;
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

/**
 * Original VogelTronics scoring fanfare — six notes, ballpark energy, built
 * from the bugle harmonics with a turn in the middle and a held top note.
 */
const FANFARE: Note[] = [
  { freq: G4, at: 0.0, duration: 0.11 },
  { freq: C5, at: 0.1, duration: 0.11 },
  { freq: E5, at: 0.2, duration: 0.11 },
  { freq: G5, at: 0.3, duration: 0.16 },
  { freq: E5, at: 0.46, duration: 0.1 },
  { freq: C6, at: 0.56, duration: 0.34 },
];

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;

  /** Browsers only allow audio after a gesture; call this from an input handler. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.28;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  private tone(note: Note, startOffset = 0): void {
    if (!this.ctx || !this.master || this.muted) return;

    const start = this.ctx.currentTime + startOffset + note.at;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = note.wave ?? 'square';
    osc.frequency.setValueAtTime(note.freq, start);

    const peak = note.gain ?? 0.6;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + note.duration);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(start);
    osc.stop(start + note.duration + 0.02);
  }

  /** One yard. A dry tick, so a whole drive of them never grates. */
  private step(): void {
    this.tone({ freq: 880, at: 0, duration: 0.035, gain: 0.22, wave: 'square' });
  }

  /**
   * The referee. A trilled high tone reads as a whistle without needing a
   * noise buffer, which would mean shipping or generating a sample.
   */
  private whistle(offset = 0): void {
    if (!this.ctx || !this.master || this.muted) return;

    const start = this.ctx.currentTime + offset;
    const duration = 0.3;

    const osc = this.ctx.createOscillator();
    const trill = this.ctx.createOscillator();
    const trillDepth = this.ctx.createGain();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2350, start);

    // Fast warble is what makes it read as a pea whistle rather than a beep.
    trill.type = 'sine';
    trill.frequency.setValueAtTime(26, start);
    trillDepth.gain.setValueAtTime(120, start);
    trill.connect(trillDepth);
    trillDepth.connect(osc.frequency);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.5, start + 0.02);
    gain.gain.setValueAtTime(0.5, start + duration - 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(this.master);

    osc.start(start);
    trill.start(start);
    osc.stop(start + duration + 0.02);
    trill.stop(start + duration + 0.02);
  }

  /** Two whistles always mean: drive over, no points. */
  private doubleWhistle(): void {
    this.whistle(0);
    this.whistle(0.36);
  }

  private fanfare(): void {
    for (const note of FANFARE) this.tone({ ...note, gain: 0.5 });
  }

  /** The boot of the ball: a quick downward swoop. */
  private kick(): void {
    if (!this.ctx || !this.master || this.muted) return;

    const start = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(620, start);
    osc.frequency.exponentialRampToValueAtTime(140, start + 0.26);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.45, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(start);
    osc.stop(start + 0.3);
  }

  private powerTone(up: boolean): void {
    this.tone({ freq: up ? 330 : 220, at: 0, duration: 0.09, gain: 0.3, wave: 'sine' });
    this.tone({ freq: up ? 660 : 165, at: 0.09, duration: 0.12, gain: 0.3, wave: 'sine' });
  }

  play(event: GameEvent): void {
    switch (event) {
      case 'step':
        return this.step();
      case 'whistle':
        return this.whistle();
      case 'double-whistle':
        return this.doubleWhistle();
      case 'fanfare':
        return this.fanfare();
      case 'kick':
        return this.kick();
      case 'power-on':
        return this.powerTone(true);
      case 'power-off':
        return this.powerTone(false);
    }
  }
}
