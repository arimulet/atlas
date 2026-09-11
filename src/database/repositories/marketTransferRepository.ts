import { suggestDevelopmentProfile } from "@atlas/domain";
import { MarketTransferModel } from "../models/marketTransfer.js";
import { MarketTransferCurrentModel } from "../models/marketTransferCurrent.js";
import { MarketTransferSyncRunModel } from "../models/marketTransferSyncRun.js";
import type {
  PersistedMarketTransfer,
  PersistedMarketTransferCurrent,
  PersistedMarketTransferSyncRun
} from "./types.js";

export async function acquireMarketTransferSyncRun(
  historyWindowFrom: Date,
  historyWindowTo: Date,
  leaseDurationMs: number = 60 * 60 * 1000 // 1 hour by default
): Promise<{ runId: string; success: boolean }> {
  const now = new Date();
  
  // 1. Release any expired runs
  await MarketTransferSyncRunModel.updateMany(
    {
      status: "running",
      leaseExpiresAt: { $lt: now }
    },
    {
      $set: {
        status: "failed",
        finishedAt: now,
        error: "Lease expired"
      }
    }
  );

  // 2. Check if a run is active
  const activeRun = await MarketTransferSyncRunModel.findOne({ status: "running" });
  if (activeRun) {
    return { runId: activeRun._id.toString(), success: false };
  }

  // 3. Create a new run
  const newRun = new MarketTransferSyncRunModel({
    status: "running",
    startedAt: now,
    leaseExpiresAt: new Date(now.getTime() + leaseDurationMs),
    historyWindow: {
      from: historyWindowFrom,
      to: historyWindowTo
    },
    counts: {
      pagesRead: 0,
      currentUpserted: 0,
      currentMissing: 0,
      finalCreatedOrUpdated: 0,
      currentDeleted: 0
    }
  });

  try {
    await newRun.save();
    return { runId: newRun._id.toString(), success: true };
  } catch {
    return { runId: "", success: false };
  }
}

export async function finishMarketTransferSyncRun(
  runId: string,
  counts: PersistedMarketTransferSyncRun["counts"],
  error?: string
): Promise<void> {
  const now = new Date();
  await MarketTransferSyncRunModel.updateOne(
    { _id: runId },
    {
      $set: {
        status: error ? "failed" : "completed",
        finishedAt: now,
        counts,
        error: error ?? null
      }
    }
  );
}

export async function getLastSuccessfulMarketTransferSyncRun(): Promise<PersistedMarketTransferSyncRun | null> {
  const doc = await MarketTransferSyncRunModel.findOne({ status: "completed" })
    .sort({ startedAt: -1 })
    .lean();
  return doc as unknown as PersistedMarketTransferSyncRun | null;
}

export async function upsertMarketTransferCurrent(
  transfer: Omit<PersistedMarketTransferCurrent, "firstSeenAt">
): Promise<void> {
  await MarketTransferCurrentModel.updateOne(
    { playerId: transfer.playerId },
    {
      $set: {
        lastSeenAt: transfer.lastSeenAt,
        deadline: transfer.deadline,
        status: transfer.status,
        lastSyncRunId: transfer.lastSyncRunId,
        player: transfer.player
      },
      $setOnInsert: {
        firstSeenAt: new Date()
      }
    },
    { upsert: true }
  );
}

export async function markMissingMarketTransferCurrent(lastSyncRunId: string): Promise<number> {
  const result = await MarketTransferCurrentModel.updateMany(
    { lastSyncRunId: { $ne: lastSyncRunId }, status: "active" },
    {
      $set: { status: "missing" }
    }
  );
  return result.modifiedCount;
}

export async function getMarketTransferCurrentByPlayerId(
  playerId: number
): Promise<PersistedMarketTransferCurrent | null> {
  const doc = await MarketTransferCurrentModel.findOne({ playerId }).lean();
  return doc as unknown as PersistedMarketTransferCurrent | null;
}

export async function getMissingMarketTransfers(): Promise<PersistedMarketTransferCurrent[]> {
  const docs = await MarketTransferCurrentModel.find({ status: "missing" }).lean();
  return docs as unknown as PersistedMarketTransferCurrent[];
}

export async function deleteMarketTransferCurrent(playerId: number): Promise<void> {
  await MarketTransferCurrentModel.deleteOne({ playerId });
}

let finalTransfersCache: {
  maxTransferDateTime: number;
  timestamp: number;
  data: PersistedMarketTransfer[];
} | null = null;

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function invalidateFinalMarketTransfersCache(): void {
  finalTransfersCache = null;
}

const MARKET_TRANSFER_PROFILES: readonly string[] = [
  "goalkeeper",
  "defender",
  "wing_defender",
  "midfielder",
  "winger",
  "forward"
];

export async function promoteToFinalMarketTransfer(
  transfer: PersistedMarketTransfer
): Promise<void> {
  const current = await MarketTransferCurrentModel.findOne({ playerId: transfer.playerId });
  if (!current) {
    throw new Error(`Cannot promote transfer for player ${transfer.playerId}: no current record found`);
  }

  const profile =
    transfer.profile ??
    suggestDevelopmentProfile({
      playerId: transfer.playerId,
      age: transfer.age,
      skills: current.player.skills
    }).profile;

  // 1. Upsert final transfer
  await MarketTransferModel.updateOne(
    { transferKey: transfer.transferKey },
    {
      $set: {
        playerId: transfer.playerId,
        name: transfer.name,
        transferDate: transfer.transferDate,
        gameWeek: transfer.gameWeek,
        season: transfer.season,
        week: transfer.week,
        salePrice: transfer.salePrice,
        age: transfer.age,
        skills: current.player.skills,
        profile
      }
    },
    { upsert: true }
  );

  // Invalidate in-memory cache
  invalidateFinalMarketTransfersCache();

  // 2. Delete current
  await MarketTransferCurrentModel.deleteOne({ playerId: transfer.playerId });
}

export async function findFinalMarketTransfersUpToDate(
  maxTransferDate: Date,
  limitPerProfile?: number
): Promise<PersistedMarketTransfer[]> {
  const now = Date.now();
  const maxTime = maxTransferDate.getTime();

  if (
    finalTransfersCache &&
    Math.abs(finalTransfersCache.maxTransferDateTime - maxTime) < 60000 &&
    now - finalTransfersCache.timestamp < CACHE_TTL_MS
  ) {
    return finalTransfersCache.data;
  }

  let data: PersistedMarketTransfer[];

  if (typeof limitPerProfile === "number" && limitPerProfile > 0) {
    // Query top N most recent transfers for each development profile in parallel using index { profile: 1, transferDate: -1 }
    const profileResults = await Promise.all(
      MARKET_TRANSFER_PROFILES.map((profile) =>
        MarketTransferModel.find({
          profile,
          transferDate: { $lte: maxTransferDate }
        })
          .sort({ transferDate: -1 })
          .limit(limitPerProfile)
          .lean()
      )
    );

    data = profileResults.flat() as unknown as PersistedMarketTransfer[];

    // Fallback for tests or legacy environments where transfers lack profile
    if (data.length === 0) {
      const docs = await MarketTransferModel.find({ transferDate: { $lte: maxTransferDate } })
        .sort({ transferDate: -1 })
        .limit(limitPerProfile * MARKET_TRANSFER_PROFILES.length)
        .lean();
      data = docs as unknown as PersistedMarketTransfer[];
    }
  } else {
    const docs = await MarketTransferModel.find({ transferDate: { $lte: maxTransferDate } })
      .sort({ transferDate: -1 })
      .lean();
    data = docs as unknown as PersistedMarketTransfer[];
  }

  finalTransfersCache = {
    maxTransferDateTime: maxTime,
    timestamp: now,
    data
  };

  return data;
}

