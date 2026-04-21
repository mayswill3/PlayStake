// ---------------------------------------------------------------------------
// Darts Audio — synthesized sounds via Web Audio API (no audio files)
// ---------------------------------------------------------------------------

import { GameAudio } from '../_shared/game-audio';

export class DartsAudio extends GameAudio {
  // ---------------------------------------------------------------------------
  // Dart hitting board — noise burst + low thud
  // accuracy: 0 (miss) to 1 (bullseye)
  // ---------------------------------------------------------------------------
  playDartImpact(accuracy: number): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // High-freq thwack (bandpass noise 600-900Hz)
    const noiseGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const noiseOsc = ctx.createOscillator();
    noiseOsc.type = 'sawtooth';
    noiseOsc.frequency.value = 600 + accuracy * 300;
    filter.type = 'bandpass';
    filter.frequency.value = 750;
    filter.Q.value = 0.8;

    noiseGain.gain.setValueAtTime(0.18 + accuracy * 0.12, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    noiseOsc.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseOsc.start(now);
    noiseOsc.stop(now + 0.08);

    // Low thud (80Hz sine)
    const thudOsc = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thudOsc.type = 'sine';
    thudOsc.frequency.setValueAtTime(90, now);
    thudOsc.frequency.linearRampToValueAtTime(60, now + 0.06);
    thudGain.gain.setValueAtTime(0.22, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    thudOsc.connect(thudGain);
    thudGain.connect(ctx.destination);
    thudOsc.start(now);
    thudOsc.stop(now + 0.1);
  }

  // ---------------------------------------------------------------------------
  // Bust — descending square wave
  // ---------------------------------------------------------------------------
  playBust(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.linearRampToValueAtTime(180, now + 0.28);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  // ---------------------------------------------------------------------------
  // Double or treble scored — resonant ping
  // ---------------------------------------------------------------------------
  playDouble(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = 440;

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  // ---------------------------------------------------------------------------
  // Bull or bullseye — two-note chime
  // ---------------------------------------------------------------------------
  playBullseye(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [
      { freq: 523.25, start: 0 },    // C5
      { freq: 659.25, start: 0.06 }, // E5
    ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = note.freq;
      gain.gain.setValueAtTime(0.001, now + note.start);
      gain.gain.linearRampToValueAtTime(0.2, now + note.start + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, now + note.start + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + note.start);
      osc.stop(now + note.start + 0.14);
    }
  }

  // ---------------------------------------------------------------------------
  // Turn change — three quick ticks
  // ---------------------------------------------------------------------------
  playTurnChange(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    [0, 0.08, 0.16].forEach(offset => {
      setTimeout(() => this.playTick(), offset * 1000);
    });
  }

  // ---------------------------------------------------------------------------
  // Throw — dart-in-flight whoosh (sawtooth sweep 1200→300 Hz, 120 ms)
  // ---------------------------------------------------------------------------
  playThrow(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.12);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  // ---------------------------------------------------------------------------
  // Round start — boxing-bell style (A4+E5 double-strike; 3 strikes for final)
  // ---------------------------------------------------------------------------
  playRoundStart(round: number): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const strikes = round >= 3 ? 3 : 2;

    for (let i = 0; i < strikes; i++) {
      for (const freq of [440, 659]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.20, now + i * 0.22);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.22 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.22);
        osc.stop(now + i * 0.22 + 0.42);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Win — extended chime (C5→E5→G5→A5→C6)
  // ---------------------------------------------------------------------------
  playWin(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const notes = [
      { freq: 523.25, start: 0,    dur: 0.08 }, // C5
      { freq: 659.25, start: 0.1,  dur: 0.08 }, // E5
      { freq: 783.99, start: 0.2,  dur: 0.08 }, // G5
      { freq: 880.00, start: 0.3,  dur: 0.10 }, // A5
      { freq: 1046.5, start: 0.42, dur: 0.16 }, // C6
    ];
    const now = ctx.currentTime;

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = note.freq;
      gain.gain.setValueAtTime(0.001, now + note.start);
      gain.gain.linearRampToValueAtTime(0.2, now + note.start + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, now + note.start + note.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + note.start);
      osc.stop(now + note.start + note.dur + 0.02);
    }
  }
}
