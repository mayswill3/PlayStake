// ---------------------------------------------------------------------------
// Game Audio — synthesized sounds via Web Audio API (no audio files)
// ---------------------------------------------------------------------------

export class GameAudio {
  private ctx: AudioContext | null = null;
  private _muted = true; // muted by default

  get muted(): boolean {
    return this._muted;
  }

  setMuted(m: boolean): void {
    this._muted = m;
  }

  /** Create/resume AudioContext. Must be called during a user gesture. */
  ensureContext(): AudioContext | null {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  // ---- White noise buffer (cached) ----
  private noiseBuffer: AudioBuffer | null = null;

  private getNoiseBuffer(): AudioBuffer | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    if (this.noiseBuffer) return this.noiseBuffer;
    const size = ctx.sampleRate; // 1 second of noise
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  // ---------------------------------------------------------------------------
  // Cue strike — short percussive white noise burst
  // ---------------------------------------------------------------------------
  playStrike(intensity: number): void {
    if (this._muted) return;
    const ctx = this.ctx;
    if (!ctx) return;
    const buffer = this.getNoiseBuffer();
    if (!buffer) return;

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const source = ctx.createBufferSource();

    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.value = 1800 + intensity * 400; // 1800-2200Hz
    filter.Q.value = 1.5;

    const maxGain = 0.1 + intensity * 0.3; // 0.1-0.4
    gain.gain.setValueAtTime(maxGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start(now);
    source.stop(now + 0.1);
  }

  // ---------------------------------------------------------------------------
  // Ball-to-ball collision — softer, shorter
  // ---------------------------------------------------------------------------
  playCollision(velocity: number): void {
    if (this._muted) return;
    const ctx = this.ctx;
    if (!ctx) return;
    const buffer = this.getNoiseBuffer();
    if (!buffer) return;

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const source = ctx.createBufferSource();

    source.buffer = buffer;
    filter.type = 'bandpass';
    const velNorm = Math.min(velocity / 15, 1);
    filter.frequency.value = 1200 + velNorm * 500; // 1200-1700Hz
    filter.Q.value = 2;

    const maxGain = 0.03 + velNorm * 0.15; // 0.03-0.18
    gain.gain.setValueAtTime(maxGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start(now);
    source.stop(now + 0.06);
  }

  // ---------------------------------------------------------------------------
  // Ball potted — deep plop (sine 120Hz, pitch bend down)
  // ---------------------------------------------------------------------------
  playPot(): void {
    if (this._muted) return;
    const ctx = this.ctx;
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.linearRampToValueAtTime(80, now + 0.2);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  // ---------------------------------------------------------------------------
  // Near miss — two quick clicks
  // ---------------------------------------------------------------------------
  playNearMiss(): void {
    if (this._muted) return;
    const ctx = this.ctx;
    if (!ctx) return;
    const buffer = this.getNoiseBuffer();
    if (!buffer) return;

    const now = ctx.currentTime;

    for (let i = 0; i < 2; i++) {
      const offset = i * 0.03; // 30ms apart
      const gain = ctx.createGain();
      const source = ctx.createBufferSource();

      source.buffer = buffer;
      gain.gain.setValueAtTime(0.05, now + offset);
      gain.gain.setValueAtTime(0.001, now + offset + 0.015);

      source.connect(gain);
      gain.connect(ctx.destination);

      source.start(now + offset);
      source.stop(now + offset + 0.02);
    }
  }

  // ---------------------------------------------------------------------------
  // Shot clock tick — barely perceptible click
  // ---------------------------------------------------------------------------
  playTick(): void {
    if (this._muted) return;
    const ctx = this.ctx;
    if (!ctx) return;
    const buffer = this.getNoiseBuffer();
    if (!buffer) return;

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    const source = ctx.createBufferSource();

    source.buffer = buffer;
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.setValueAtTime(0.001, now + 0.01);

    source.connect(gain);
    gain.connect(ctx.destination);

    source.start(now);
    source.stop(now + 0.015);
  }

  // ---------------------------------------------------------------------------
  // Win chime — C5 → E5 → G5 ascending
  // ---------------------------------------------------------------------------
  playWinChime(): void {
    if (this._muted) return;
    const ctx = this.ctx;
    if (!ctx) return;

    const notes = [
      { freq: 523.25, start: 0, dur: 0.08 }, // C5
      { freq: 659.25, start: 0.1, dur: 0.08 }, // E5
      { freq: 783.99, start: 0.2, dur: 0.12 }, // G5
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

  // ---------------------------------------------------------------------------
  // Bullseye settle — pitch inversely proportional to distance
  // ---------------------------------------------------------------------------
  playBullseyeSettle(distance: number): void {
    if (this._muted) return;
    const ctx = this.ctx;
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Closer = lower pitch (more satisfying), further = higher
    // distance is in table units, typically 0-50
    const distNorm = Math.min(distance / 50, 1);
    const freq = 200 + distNorm * 400; // 200-600Hz

    osc.type = 'sine';
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  }
}
