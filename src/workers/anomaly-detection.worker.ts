// =============================================================================
// PlayStake — Anomaly Detection Worker (C8)
// =============================================================================
// Analyzes per-developer betting patterns to detect fraud and manipulation.
// Runs every 15 minutes and checks for:
//   1. Win-rate skew (any player >80% win rate)
//   2. Single-winner streaks (>10 consecutive wins)
//   3. Rapid settlement (avg time from creation to result <30 seconds)
//   4. Volume spikes (hourly volume >3x 7-day average)
// =============================================================================

import { Worker, type Job } from "bullmq";
import { Decimal } from "@prisma/client/runtime/client";
import { BetStatus } from "../../generated/prisma/client";
import { getRedisConnection } from "../lib/jobs/queue";
import {
  QUEUE_NAMES,
  type AnomalyDetectionScanPayload,
} from "../lib/jobs/types";
import { prisma } from "../lib/db/client";

// ---------------------------------------------------------------------------
// Logging helper
// ---------------------------------------------------------------------------

function log(level: string, msg: string, data?: Record<string, unknown>): void {
  console.log(
    JSON.stringify({ level, msg, worker: "anomaly-detection", ...data })
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeveloperForAnalysis {
  id: string;
  userId: string;
  games: { id: string; isActive: boolean }[];
  escrowLimit: { id: string; maxTotalEscrow: Decimal } | null;
}

// ---------------------------------------------------------------------------
// Detection: Win-rate skew
// ---------------------------------------------------------------------------

async function detectWinRateSkew(
  developer: DeveloperForAnalysis
): Promise<void> {
  const gameIds = developer.games.map((g) => g.id);
  if (gameIds.length === 0) return;

  // Query last 100 settled bets per developer to analyze win rates
  const recentBets = await prisma.bet.findMany({
    where: {
      gameId: { in: gameIds },
      status: BetStatus.SETTLED,
      outcome: { not: null },
    },
    select: {
      id: true,
      playerAId: true,
      playerBId: true,
      outcome: true,
    },
    orderBy: { settledAt: "desc" },
    take: 100,
  });

  if (recentBets.length < 20) return; // Not enough data

  // Count wins per player
  const winCounts = new Map<string, number>();
  const betCounts = new Map<string, number>();

  for (const bet of recentBets) {
    if (!bet.playerBId || !bet.outcome) continue;

    // Count participation
    betCounts.set(bet.playerAId, (betCounts.get(bet.playerAId) ?? 0) + 1);
    betCounts.set(bet.playerBId, (betCounts.get(bet.playerBId) ?? 0) + 1);

    // Count wins
    if (bet.outcome === "PLAYER_A_WIN") {
      winCounts.set(bet.playerAId, (winCounts.get(bet.playerAId) ?? 0) + 1);
    } else if (bet.outcome === "PLAYER_B_WIN") {
      winCounts.set(bet.playerBId, (winCounts.get(bet.playerBId) ?? 0) + 1);
    }
  }

  // Flag players with >80% win rate (min 10 bets for statistical relevance)
  for (const [playerId, totalBets] of betCounts.entries()) {
    if (totalBets < 10) continue;
    const wins = winCounts.get(playerId) ?? 0;
    const winRate = wins / totalBets;

    if (winRate > 0.8) {
      // Check if we already flagged this recently
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existing = await prisma.anomalyAlert.findFirst({
        where: {
          developerProfileId: developer.id,
          type: "SKEWED_WIN_RATE",
          createdAt: { gte: oneDayAgo },
          details: {
            path: ["playerId"],
            equals: playerId,
          },
        },
      });

      if (existing) continue;

      const severity = winRate > 0.95 ? "HIGH" : "MEDIUM";

      await prisma.anomalyAlert.create({
        data: {
          developerProfileId: developer.id,
          type: "SKEWED_WIN_RATE",
          status: "DETECTED",
          severity,
          autoAction: severity === "HIGH" ? "escrow_cap_reduced_50pct" : null,
          details: {
            playerId,
            winRate: Math.round(winRate * 100),
            wins,
            totalBets,
            sampleSize: recentBets.length,
          },
        },
      });

      log("warn", "skewed_win_rate_detected", {
        developerProfileId: developer.id,
        playerId,
        winRate: Math.round(winRate * 100),
        severity,
      });

      if (severity === "HIGH") {
        await reduceEscrowCap(developer);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Detection: Single-winner streak
// ---------------------------------------------------------------------------

async function detectSingleWinnerPattern(
  developer: DeveloperForAnalysis
): Promise<void> {
  const gameIds = developer.games.map((g) => g.id);
  if (gameIds.length === 0) return;

  const recentBets = await prisma.bet.findMany({
    where: {
      gameId: { in: gameIds },
      status: BetStatus.SETTLED,
      outcome: { not: null },
    },
    select: {
      id: true,
      playerAId: true,
      playerBId: true,
      outcome: true,
    },
    orderBy: { settledAt: "desc" },
    take: 100,
  });

  if (recentBets.length < 11) return;

  // Determine winner for each bet and check for streaks
  let currentWinner: string | null = null;
  let streak = 0;
  let maxStreak = 0;
  let maxStreakPlayerId: string | null = null;

  for (const bet of recentBets) {
    if (!bet.playerBId || !bet.outcome) continue;

    let winnerId: string | null = null;
    if (bet.outcome === "PLAYER_A_WIN") winnerId = bet.playerAId;
    else if (bet.outcome === "PLAYER_B_WIN") winnerId = bet.playerBId;
    else continue; // DRAW does not extend a streak

    if (winnerId === currentWinner) {
      streak++;
    } else {
      currentWinner = winnerId;
      streak = 1;
    }

    if (streak > maxStreak) {
      maxStreak = streak;
      maxStreakPlayerId = winnerId;
    }
  }

  if (maxStreak > 10 && maxStreakPlayerId) {
    // Check for recent existing alert
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await prisma.anomalyAlert.findFirst({
      where: {
        developerProfileId: developer.id,
        type: "SINGLE_WINNER_PATTERN",
        createdAt: { gte: oneDayAgo },
      },
    });

    if (existing) return;

    const severity = maxStreak > 20 ? "CRITICAL" : "HIGH";

    await prisma.anomalyAlert.create({
      data: {
        developerProfileId: developer.id,
        type: "SINGLE_WINNER_PATTERN",
        status: "DETECTED",
        severity,
        autoAction:
          severity === "CRITICAL"
            ? "developer_frozen"
            : "escrow_cap_reduced_50pct",
        details: {
          playerId: maxStreakPlayerId,
          consecutiveWins: maxStreak,
          sampleSize: recentBets.length,
        },
      },
    });

    log("warn", "single_winner_pattern_detected", {
      developerProfileId: developer.id,
      playerId: maxStreakPlayerId,
      consecutiveWins: maxStreak,
      severity,
    });

    if (severity === "CRITICAL") {
      await freezeDeveloper(developer);
    } else {
      await reduceEscrowCap(developer);
    }
  }
}

// ---------------------------------------------------------------------------
// Detection: Rapid settlement
// ---------------------------------------------------------------------------

async function detectRapidSettlement(
  developer: DeveloperForAnalysis
): Promise<void> {
  const gameIds = developer.games.map((g) => g.id);
  if (gameIds.length === 0) return;

  // Use raw query for date arithmetic
  const results: { avg_seconds: number | null }[] = await prisma.$queryRaw`
    SELECT AVG(EXTRACT(EPOCH FROM (result_reported_at - created_at))) as avg_seconds
    FROM bets
    WHERE game_id = ANY(${gameIds}::uuid[])
      AND status = 'SETTLED'
      AND result_reported_at IS NOT NULL
      AND settled_at > NOW() - INTERVAL '24 hours'
  `;

  const avgSeconds = results[0]?.avg_seconds;
  if (avgSeconds === null || avgSeconds === undefined) return;

  if (avgSeconds < 30) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await prisma.anomalyAlert.findFirst({
      where: {
        developerProfileId: developer.id,
        type: "RAPID_BET_SETTLEMENT",
        createdAt: { gte: oneDayAgo },
      },
    });

    if (existing) return;

    const severity = avgSeconds < 10 ? "HIGH" : "MEDIUM";

    await prisma.anomalyAlert.create({
      data: {
        developerProfileId: developer.id,
        type: "RAPID_BET_SETTLEMENT",
        status: "DETECTED",
        severity,
        autoAction: severity === "HIGH" ? "escrow_cap_reduced_50pct" : null,
        details: {
          avgSecondsFromCreationToResult: Math.round(avgSeconds),
          threshold: 30,
          period: "24_hours",
        },
      },
    });

    log("warn", "rapid_settlement_detected", {
      developerProfileId: developer.id,
      avgSeconds: Math.round(avgSeconds),
      severity,
    });

    if (severity === "HIGH") {
      await reduceEscrowCap(developer);
    }
  }
}

// ---------------------------------------------------------------------------
// Detection: Volume spike
// ---------------------------------------------------------------------------

async function detectVolumeSpike(
  developer: DeveloperForAnalysis
): Promise<void> {
  const gameIds = developer.games.map((g) => g.id);
  if (gameIds.length === 0) return;

  // Current hour bet count
  const currentHourResult: { count: bigint }[] = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM bets
    WHERE game_id = ANY(${gameIds}::uuid[])
      AND created_at > NOW() - INTERVAL '1 hour'
  `;
  const currentHourCount = Number(currentHourResult[0]?.count ?? 0);

  // 7-day hourly average
  const weeklyAvgResult: { avg_hourly: number | null }[] = await prisma.$queryRaw`
    SELECT COUNT(*)::float / GREATEST(EXTRACT(EPOCH FROM (NOW() - MIN(created_at))) / 3600, 1) as avg_hourly
    FROM bets
    WHERE game_id = ANY(${gameIds}::uuid[])
      AND created_at > NOW() - INTERVAL '7 days'
  `;
  const avgHourly = weeklyAvgResult[0]?.avg_hourly ?? 0;

  if (avgHourly < 1) return; // Not enough historical data

  if (currentHourCount > avgHourly * 3) {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const existing = await prisma.anomalyAlert.findFirst({
      where: {
        developerProfileId: developer.id,
        type: "HIGH_VOLUME_SPIKE",
        createdAt: { gte: sixHoursAgo },
      },
    });

    if (existing) return;

    const ratio = currentHourCount / avgHourly;
    const severity = ratio > 10 ? "HIGH" : "MEDIUM";

    await prisma.anomalyAlert.create({
      data: {
        developerProfileId: developer.id,
        type: "HIGH_VOLUME_SPIKE",
        status: "DETECTED",
        severity,
        autoAction: severity === "HIGH" ? "escrow_cap_reduced_50pct" : null,
        details: {
          currentHourCount,
          avgHourlyCount: Math.round(avgHourly * 100) / 100,
          ratio: Math.round(ratio * 100) / 100,
          threshold: 3,
        },
      },
    });

    log("warn", "volume_spike_detected", {
      developerProfileId: developer.id,
      currentHourCount,
      avgHourly: Math.round(avgHourly * 100) / 100,
      ratio: Math.round(ratio * 100) / 100,
      severity,
    });

    if (severity === "HIGH") {
      await reduceEscrowCap(developer);
    }
  }
}

// ---------------------------------------------------------------------------
// Auto-actions
// ---------------------------------------------------------------------------

async function reduceEscrowCap(
  developer: DeveloperForAnalysis
): Promise<void> {
  if (!developer.escrowLimit) return;

  const newMax = new Decimal(developer.escrowLimit.maxTotalEscrow.toString())
    .mul(0.5)
    .toDecimalPlaces(2);

  await prisma.developerEscrowLimit.update({
    where: { id: developer.escrowLimit.id },
    data: { maxTotalEscrow: newMax },
  });

  log("warn", "escrow_cap_auto_reduced", {
    developerProfileId: developer.id,
    previousMax: developer.escrowLimit.maxTotalEscrow.toString(),
    newMax: newMax.toString(),
  });
}

async function freezeDeveloper(
  developer: DeveloperForAnalysis
): Promise<void> {
  // Deactivate all games
  const activeGameIds = developer.games
    .filter((g) => g.isActive)
    .map((g) => g.id);

  if (activeGameIds.length > 0) {
    await prisma.game.updateMany({
      where: { id: { in: activeGameIds } },
      data: { isActive: false },
    });
  }

  // Suspend all API keys for this developer
  await prisma.apiKey.updateMany({
    where: {
      developerProfileId: developer.id,
      isActive: true,
    },
    data: {
      isActive: false,
      revokedAt: new Date(),
    },
  });

  log("error", "developer_frozen", {
    developerProfileId: developer.id,
    gamesDeactivated: activeGameIds.length,
  });
}

// ---------------------------------------------------------------------------
// Worker processor
// ---------------------------------------------------------------------------

async function processAnomalyDetectionScan(
  _job: Job<AnomalyDetectionScanPayload>
): Promise<void> {
  // Fetch all developers who have at least one game with recent activity
  const developers = await prisma.developerProfile.findMany({
    where: {
      isApproved: true,
      games: {
        some: {
          bets: {
            some: {
              createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            },
          },
        },
      },
    },
    include: {
      games: {
        select: { id: true, isActive: true },
      },
      escrowLimit: {
        select: { id: true, maxTotalEscrow: true },
      },
    },
  });

  if (developers.length === 0) {
    return;
  }

  log("info", "anomaly_scan_started", {
    developerCount: developers.length,
  });

  for (const dev of developers) {
    try {
      await detectWinRateSkew(dev);
      await detectSingleWinnerPattern(dev);
      await detectRapidSettlement(dev);
      await detectVolumeSpike(dev);
    } catch (error) {
      log("error", "anomaly_detection_failed_for_developer", {
        developerProfileId: dev.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  log("info", "anomaly_scan_completed", {
    developerCount: developers.length,
  });
}

// ---------------------------------------------------------------------------
// Worker instance
// ---------------------------------------------------------------------------

export function createAnomalyDetectionWorker(): Worker<AnomalyDetectionScanPayload> {
  const worker = new Worker<AnomalyDetectionScanPayload>(
    QUEUE_NAMES.ANOMALY_DETECTION,
    processAnomalyDetectionScan,
    {
      connection: getRedisConnection(),
      concurrency: 1,
    }
  );

  worker.on("failed", (job, err) => {
    log("error", "anomaly_detection_job_failed", {
      jobId: job?.id,
      error: err.message,
    });
  });

  worker.on("error", (err) => {
    log("error", "anomaly_detection_worker_error", { error: err.message });
  });

  log("info", "anomaly_detection_worker_started");
  return worker;
}
