// ---------------------------------------------------------------------------
// Game Effects Manager — lightweight visual effect queue for canvas rendering
// ---------------------------------------------------------------------------

export type PhysicsEvent =
  | { type: 'collision'; x: number; y: number; velocity: number }
  | { type: 'pocketed'; ballId: number | string; pocketX: number; pocketY: number }
  | { type: 'nearMiss'; ballId: number | string; pocketX: number; pocketY: number };

// ---------------------------------------------------------------------------
// Effect types
// ---------------------------------------------------------------------------

interface BaseEffect {
  id: number;
  startTime: number;
  duration: number;
}

interface ImpactEffect extends BaseEffect {
  type: 'impact';
  x: number;
  y: number;
  angle: number;
  intensity: number; // 0-1
}

interface CollisionEffect extends BaseEffect {
  type: 'collision';
  x: number;
  y: number;
  velocity: number;
}

interface PocketRippleEffect extends BaseEffect {
  type: 'pocketRipple';
  x: number;
  y: number;
}

interface GhostBallEffect extends BaseEffect {
  type: 'ghostBall';
  x: number;
  y: number;
  color: string;
  radius: number;
}

interface ParticleBurstEffect extends BaseEffect {
  type: 'particleBurst';
  x: number;
  y: number;
  particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
  }>;
}

interface SonarPingEffect extends BaseEffect {
  type: 'sonarPing';
  x: number;
  y: number;
  maxRadius: number;
}

interface BullseyeLandingEffect extends BaseEffect {
  type: 'bullseyeLanding';
  x: number;
  y: number;
  zone: 'inner' | 'middle';
}

type GameEffect =
  | ImpactEffect
  | CollisionEffect
  | PocketRippleEffect
  | GhostBallEffect
  | ParticleBurstEffect
  | SonarPingEffect
  | BullseyeLandingEffect;

// Spawn params (omit auto-filled fields)
export type SpawnEffect =
  | Omit<ImpactEffect, 'id' | 'startTime'>
  | Omit<CollisionEffect, 'id' | 'startTime'>
  | Omit<PocketRippleEffect, 'id' | 'startTime'>
  | Omit<GhostBallEffect, 'id' | 'startTime'>
  | Omit<ParticleBurstEffect, 'id' | 'startTime'>
  | Omit<SonarPingEffect, 'id' | 'startTime'>
  | Omit<BullseyeLandingEffect, 'id' | 'startTime'>;

// ---------------------------------------------------------------------------
// EffectsManager
// ---------------------------------------------------------------------------

export class EffectsManager {
  private effects: GameEffect[] = [];
  private rattles = new Map<string, number>(); // ballId → endTime
  private collisionCooldowns = new Map<string, number>(); // "a-b" → endTime
  private nearMissCooldowns = new Map<string, number>(); // "ballId-pocketIdx" → endTime
  private nextId = 0;
  private reducedMotion: boolean;

  constructor() {
    this.reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  spawn(effect: SpawnEffect): void {
    if (this.reducedMotion) return;
    const full = {
      ...effect,
      id: this.nextId++,
      startTime: performance.now(),
    } as GameEffect;
    this.effects.push(full);
  }

  /** Spawn with collision dedup (100ms cooldown per pair) */
  spawnCollision(
    x: number,
    y: number,
    velocity: number,
    ballA: number | string,
    ballB: number | string
  ): boolean {
    const key = String(ballA) < String(ballB) ? `${ballA}-${ballB}` : `${ballB}-${ballA}`;
    const now = performance.now();
    const cd = this.collisionCooldowns.get(key);
    if (cd && now < cd) return false;
    this.collisionCooldowns.set(key, now + 100);
    this.spawn({ type: 'collision', x, y, velocity, duration: 80 });
    return true;
  }

  /** Spawn with near-miss dedup (500ms cooldown per ball+pocket) */
  spawnNearMiss(ballId: number | string, pocketKey: string): boolean {
    const key = `${ballId}-${pocketKey}`;
    const now = performance.now();
    const cd = this.nearMissCooldowns.get(key);
    if (cd && now < cd) return false;
    this.nearMissCooldowns.set(key, now + 500);
    this.spawnRattle(ballId, 180);
    return true;
  }

  spawnRattle(ballId: number | string, durationMs: number): void {
    if (this.reducedMotion) return;
    this.rattles.set(String(ballId), performance.now() + durationMs);
  }

  getRattleOffset(ballId: number | string, now: number): number {
    const endTime = this.rattles.get(String(ballId));
    if (!endTime || now >= endTime) {
      if (endTime) this.rattles.delete(String(ballId));
      return 0;
    }
    const elapsed = endTime - now; // ms remaining
    return Math.sin(now * 0.05) * 2 * Math.min(elapsed / 100, 1);
  }

  render(ctx: CanvasRenderingContext2D, now: number): void {
    if (this.reducedMotion) return;

    // Prune expired + draw active
    this.effects = this.effects.filter((e) => {
      const elapsed = now - e.startTime;
      if (elapsed >= e.duration) return false;
      const progress = elapsed / e.duration;
      this.drawEffect(ctx, e, progress, elapsed);
      return true;
    });

    // Prune expired cooldowns (periodically)
    if (this.nextId % 60 === 0) {
      for (const [k, v] of this.collisionCooldowns) {
        if (now > v) this.collisionCooldowns.delete(k);
      }
      for (const [k, v] of this.nearMissCooldowns) {
        if (now > v) this.nearMissCooldowns.delete(k);
      }
    }
  }

  private drawEffect(
    ctx: CanvasRenderingContext2D,
    e: GameEffect,
    progress: number,
    elapsed: number
  ): void {
    switch (e.type) {
      case 'impact':
        this.drawImpact(ctx, e, progress);
        break;
      case 'collision':
        this.drawCollision(ctx, e, progress);
        break;
      case 'pocketRipple':
        this.drawPocketRipple(ctx, e, progress);
        break;
      case 'ghostBall':
        this.drawGhostBall(ctx, e, progress);
        break;
      case 'particleBurst':
        this.drawParticleBurst(ctx, e, progress, elapsed);
        break;
      case 'sonarPing':
        this.drawSonarPing(ctx, e, progress, elapsed);
        break;
      case 'bullseyeLanding':
        this.drawBullseyeLanding(ctx, e, progress);
        break;
    }
  }

  // ---- Impact: 3-4 radial lines from contact point ----
  private drawImpact(
    ctx: CanvasRenderingContext2D,
    e: ImpactEffect,
    progress: number
  ): void {
    const lineCount = 4;
    const maxLen = 40 * e.intensity;
    const growPhase = Math.min(progress / 0.4, 1);
    const fadePhase = progress > 0.4 ? (progress - 0.4) / 0.6 : 0;
    const len = maxLen * growPhase;
    const opacity = 0.8 * (1 - fadePhase);

    ctx.save();
    ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';

    const spread = Math.PI * 0.4; // 72 degree spread
    for (let i = 0; i < lineCount; i++) {
      const a = e.angle - spread / 2 + (spread / (lineCount - 1)) * i;
      const startDist = 4;
      ctx.beginPath();
      ctx.moveTo(e.x + Math.cos(a) * startDist, e.y + Math.sin(a) * startDist);
      ctx.lineTo(e.x + Math.cos(a) * (startDist + len), e.y + Math.sin(a) * (startDist + len));
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---- Collision: smaller radial lines at contact midpoint ----
  private drawCollision(
    ctx: CanvasRenderingContext2D,
    e: CollisionEffect,
    progress: number
  ): void {
    const lineCount = 5;
    const scale = Math.min(e.velocity / 15, 1);
    const maxLen = 20 * scale;
    const growPhase = Math.min(progress / 0.35, 1);
    const fadePhase = progress > 0.35 ? (progress - 0.35) / 0.65 : 0;
    const len = maxLen * growPhase;
    const opacity = 0.6 * (1 - fadePhase);

    ctx.save();
    ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';

    for (let i = 0; i < lineCount; i++) {
      const a = (Math.PI * 2 * i) / lineCount;
      const startDist = 3;
      ctx.beginPath();
      ctx.moveTo(e.x + Math.cos(a) * startDist, e.y + Math.sin(a) * startDist);
      ctx.lineTo(e.x + Math.cos(a) * (startDist + len), e.y + Math.sin(a) * (startDist + len));
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---- Pocket ripple: expanding ring from pocket center ----
  private drawPocketRipple(
    ctx: CanvasRenderingContext2D,
    e: PocketRippleEffect,
    progress: number
  ): void {
    const startRadius = 14; // ~pocket radius
    const endRadius = startRadius + 30;
    const radius = startRadius + (endRadius - startRadius) * progress;
    const opacity = 0.3 * (1 - progress);
    const lineWidth = 2 * (1 - progress);

    ctx.save();
    ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.arc(e.x, e.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ---- Ghost ball: shrinking copy at pocket position ----
  private drawGhostBall(
    ctx: CanvasRenderingContext2D,
    e: GhostBallEffect,
    progress: number
  ): void {
    const radius = e.radius * (1 - progress);
    if (radius < 0.5) return;
    const opacity = 0.7 * (1 - progress);

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.beginPath();
    ctx.arc(e.x, e.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = e.color;
    ctx.fill();
    ctx.restore();
  }

  // ---- Particle burst: gravity-affected gold + white particles ----
  private drawParticleBurst(
    ctx: CanvasRenderingContext2D,
    e: ParticleBurstEffect,
    progress: number,
    elapsed: number
  ): void {
    const opacity = 1 - progress;
    const dt = elapsed / 16.67; // approximate frame count

    ctx.save();
    ctx.globalAlpha = opacity;
    for (const p of e.particles) {
      // Update position (gravity)
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08; // gentle gravity
      p.vx *= 0.99; // slight drag

      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.restore();
  }

  // ---- Sonar ping: 3 concentric rings expanding staggered ----
  private drawSonarPing(
    ctx: CanvasRenderingContext2D,
    e: SonarPingEffect,
    progress: number,
    elapsed: number
  ): void {
    ctx.save();
    for (let ring = 0; ring < 3; ring++) {
      const ringDelay = ring * 100; // ms stagger
      const ringElapsed = elapsed - ringDelay;
      if (ringElapsed <= 0) continue;
      const ringProgress = Math.min(ringElapsed / (e.duration - ringDelay), 1);
      const radius = e.maxRadius * ringProgress;
      const opacity = 0.4 * (1 - ringProgress);

      ctx.strokeStyle = `rgba(245, 216, 0, ${opacity})`;
      ctx.lineWidth = 1.5 * (1 - ringProgress);
      ctx.beginPath();
      ctx.arc(e.x, e.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---- Bullseye landing: single expanding ring ----
  private drawBullseyeLanding(
    ctx: CanvasRenderingContext2D,
    e: BullseyeLandingEffect,
    progress: number
  ): void {
    const maxRadius = e.zone === 'inner' ? 30 : 20;
    const radius = maxRadius * progress;
    const opacity = (e.zone === 'inner' ? 0.5 : 0.35) * (1 - progress);
    const color =
      e.zone === 'inner'
        ? `rgba(245, 216, 0, ${opacity})`
        : `rgba(0, 255, 135, ${opacity})`;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 * (1 - progress);
    ctx.beginPath();
    ctx.arc(e.x, e.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate particles for win burst */
export function generateBurstParticles(
  count: number,
  x: number,
  y: number
): Array<{ x: number; y: number; vx: number; vy: number; color: string; size: number }> {
  const particles = [];
  const colors = ['#f5d800', '#ffffff', '#f5d800', '#ffffff', '#ffe066'];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
    const speed = 2 + Math.random() * 5;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2, // initial upward bias
      color: colors[i % colors.length],
      size: 2 + Math.random() * 1.5,
    });
  }
  return particles;
}
