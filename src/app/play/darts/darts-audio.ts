// ---------------------------------------------------------------------------
// Darts Audio — synthesized sounds via Web Audio API (no external files)
// ---------------------------------------------------------------------------

import { GameAudio } from '../_shared/game-audio';

export class DartsAudio extends GameAudio {
  constructor() {
    super();
    this.setMuted(false); // unmuted by default — game has no mute toggle
  }

  // ---------------------------------------------------------------------------
  // Dart throw — sharp whoosh (shaped noise + pitch sweep)
  // ---------------------------------------------------------------------------
  playThrow(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Noise burst shaped into a whoosh
    const bufSize = ctx.sampleRate * 0.15;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const hipass = ctx.createBiquadFilter();
    hipass.type = 'highpass';
    hipass.frequency.setValueAtTime(2000, now);
    hipass.frequency.linearRampToValueAtTime(400, now + 0.13);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    src.connect(hipass);
    hipass.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.15);
  }

  // ---------------------------------------------------------------------------
  // Dart hitting board — sharp thwack + wooden thud
  // ---------------------------------------------------------------------------
  playDartImpact(accuracy: number): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Sharp crack (noise burst)
    const crackBuf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
    const crackData = crackBuf.getChannelData(0);
    for (let i = 0; i < crackData.length; i++) crackData[i] = Math.random() * 2 - 1;

    const crackSrc = ctx.createBufferSource();
    crackSrc.buffer = crackBuf;

    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = 'bandpass';
    crackFilter.frequency.value = 3000 + accuracy * 1500;
    crackFilter.Q.value = 0.5;

    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(0.55 + accuracy * 0.25, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    crackSrc.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(ctx.destination);
    crackSrc.start(now);
    crackSrc.stop(now + 0.07);

    // Woody resonance thud
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(180 + accuracy * 80, now);
    thud.frequency.exponentialRampToValueAtTime(60, now + 0.08);
    thudGain.gain.setValueAtTime(0.3, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    thud.connect(thudGain);
    thudGain.connect(ctx.destination);
    thud.start(now);
    thud.stop(now + 0.12);
  }

  // ---------------------------------------------------------------------------
  // Bust — descending failure tones
  // ---------------------------------------------------------------------------
  playBust(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Two descending tones: classic "fail" feel
    const notes = [
      { freq: 440, start: 0,    dur: 0.15 },
      { freq: 330, start: 0.14, dur: 0.18 },
      { freq: 220, start: 0.28, dur: 0.22 },
    ];

    for (const n of notes) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = n.freq;
      g.gain.setValueAtTime(0.001, now + n.start);
      g.gain.linearRampToValueAtTime(0.12, now + n.start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(now + n.start);
      osc.stop(now + n.start + n.dur + 0.02);
    }
  }

  // ---------------------------------------------------------------------------
  // Double or treble scored — bright metallic ping
  // ---------------------------------------------------------------------------
  playDouble(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    for (const [i, freq] of [[0, 880], [1, 1108]] as const) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.001, now + i * 0.04);
      g.gain.linearRampToValueAtTime(0.18, now + i * 0.04 + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.18);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(now + i * 0.04);
      osc.stop(now + i * 0.04 + 0.2);
    }
  }

  // ---------------------------------------------------------------------------
  // Bull or bullseye — rich resonant chime (3 harmonics)
  // ---------------------------------------------------------------------------
  playBullseye(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // C5, E5, G5 — bright major chord, staggered
    const notes = [
      { freq: 523.25, start: 0,    vol: 0.22 },
      { freq: 659.25, start: 0.05, vol: 0.20 },
      { freq: 783.99, start: 0.10, vol: 0.18 },
    ];

    for (const n of notes) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = n.freq;
      g.gain.setValueAtTime(0.001, now + n.start);
      g.gain.linearRampToValueAtTime(n.vol, now + n.start + 0.006);
      g.gain.exponentialRampToValueAtTime(0.001, now + n.start + 0.5);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(now + n.start);
      osc.stop(now + n.start + 0.55);
    }
  }

  // ---------------------------------------------------------------------------
  // Turn change — two soft clave ticks
  // ---------------------------------------------------------------------------
  playTurnChange(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    [0, 0.1].forEach(offset => {
      setTimeout(() => this.playTick(), offset * 1000);
    });
  }

  // ---------------------------------------------------------------------------
  // Round start — boxing bell (FM synthesis, number of strikes = round)
  // ---------------------------------------------------------------------------
  playRoundStart(round: number): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const strikes = round >= 3 ? 3 : 2;

    for (let i = 0; i < strikes; i++) {
      const t = now + i * 0.28;

      // Carrier sine
      const carrier = ctx.createOscillator();
      const modulator = ctx.createOscillator();
      const modGain = ctx.createGain();
      const outGain = ctx.createGain();

      carrier.type = 'sine';
      carrier.frequency.value = 587; // D5
      modulator.type = 'sine';
      modulator.frequency.value = 587 * 7; // 7th harmonic → bell-like
      modGain.gain.setValueAtTime(600, t);
      modGain.gain.exponentialRampToValueAtTime(1, t + 0.5);

      outGain.gain.setValueAtTime(0.28, t);
      outGain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(outGain);
      outGain.connect(ctx.destination);

      modulator.start(t); modulator.stop(t + 0.6);
      carrier.start(t); carrier.stop(t + 0.6);
    }
  }

  // ---------------------------------------------------------------------------
  // Win — triumphant ascending fanfare
  // ---------------------------------------------------------------------------
  playWin(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [
      { freq: 523.25, start: 0,    dur: 0.10 }, // C5
      { freq: 659.25, start: 0.11, dur: 0.10 }, // E5
      { freq: 783.99, start: 0.22, dur: 0.10 }, // G5
      { freq: 1046.5, start: 0.33, dur: 0.10 }, // C6
      { freq: 1318.5, start: 0.44, dur: 0.22 }, // E6 — held finish
    ];

    for (const n of notes) {
      for (const type of ['sine', 'triangle'] as OscillatorType[]) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.value = n.freq;
        const vol = type === 'sine' ? 0.22 : 0.08;
        g.gain.setValueAtTime(0.001, now + n.start);
        g.gain.linearRampToValueAtTime(vol, now + n.start + 0.008);
        g.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur + 0.05);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(now + n.start);
        osc.stop(now + n.start + n.dur + 0.08);
      }
    }
  }
}
