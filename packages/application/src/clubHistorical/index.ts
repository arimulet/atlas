import {
  ClubId,
  MongoSnapshotRepository,
  type PersistedPlayerSnapshot,
  type PersistedSnapshot
} from "@atlas/database";
import {
  generateHistoricalFindings,
  calculateHistoricalTrends,
  type HistoricalFindings,
  type HistoricalTrends,
  type SnapshotComparisonPlayer,
  type SnapshotComparisonSnapshot
} from "@atlas/domain";
import { formatDate } from "@atlas/utils";

const snapshotRepository = new MongoSnapshotRepository();

const inFlightHistoricalTrends = new Map<string, Promise<HistoricalTrends>>();
const historicalTrendsCache = new Map<string, { data: HistoricalTrends; timestamp: number }>();
const inFlightHistoricalFindings = new Map<string, Promise<HistoricalFindings>>();
const historicalFindingsCache = new Map<string, { data: HistoricalFindings; timestamp: number }>();
const HISTORICAL_CACHE_TTL_MS = 60_000;

export function invalidateHistoricalTrendsCache(clubId?: ClubId): void {
  if (clubId) {
    historicalTrendsCache.delete(String(clubId));
  } else {
    historicalTrendsCache.clear();
  }
}

export function invalidateHistoricalFindingsCache(clubId?: ClubId): void {
  if (clubId) {
    historicalFindingsCache.delete(String(clubId));
  } else {
    historicalFindingsCache.clear();
  }
}

export const calculateClubHistoricalTrends = async (clubId: ClubId): Promise<HistoricalTrends> => {
  const cacheKey = String(clubId);
  const cached = historicalTrendsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < HISTORICAL_CACHE_TTL_MS) {
    return cached.data;
  }

  const existingInFlight = inFlightHistoricalTrends.get(cacheKey);
  if (existingInFlight) {
    return existingInFlight;
  }

  const compute = async (): Promise<HistoricalTrends> => {
    const snapshots = await snapshotRepository.listByClub(clubId);

    if (snapshots.length === 0) {
      throw new Error("No snapshots found for club.");
    }

    const result = calculateHistoricalTrends(snapshots.map(mapSnapshot));
    historicalTrendsCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  };

  const executionPromise = compute().finally(() => {
    inFlightHistoricalTrends.delete(cacheKey);
  });

  inFlightHistoricalTrends.set(cacheKey, executionPromise);
  return executionPromise;
};

export const generateClubHistoricalFindings = async (
  clubId: ClubId
): Promise<HistoricalFindings> => {
  const cacheKey = String(clubId);
  const cached = historicalFindingsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < HISTORICAL_CACHE_TTL_MS) {
    return cached.data;
  }

  const existingInFlight = inFlightHistoricalFindings.get(cacheKey);
  if (existingInFlight) {
    return existingInFlight;
  }

  const compute = async (): Promise<HistoricalFindings> => {
    const snapshots = await snapshotRepository.listByClub(clubId);

    if (snapshots.length === 0) {
      throw new Error("No snapshots found for club.");
    }

    const result = generateHistoricalFindings(snapshots.map(mapSnapshot));
    historicalFindingsCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  };

  const executionPromise = compute().finally(() => {
    inFlightHistoricalFindings.delete(cacheKey);
  });

  inFlightHistoricalFindings.set(cacheKey, executionPromise);
  return executionPromise;
};

function mapSnapshot(snapshot: PersistedSnapshot): SnapshotComparisonSnapshot {
  return {
    id: snapshot.id,
    clubId: String(snapshot.clubId),
    snapshotDate: formatDate(snapshot.snapshotDate),
    players: snapshot.players.map(mapPlayer)
  };
}

function mapPlayer(player: PersistedPlayerSnapshot): SnapshotComparisonPlayer {
  return {
    id: player.id,
    playerId: player.playerId,
    name: player.name,
    age: player.age,
    wage: { amount: player.wage, currency: null },
    value: { amount: player.value, currency: null },
    skills: player.skills
  };
}
