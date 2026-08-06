import {
  MongoSnapshotRepository,
  type PersistedPlayerSnapshot,
  type PersistedSnapshot
} from "@atlas/database";
import {
  calculateHistoricalTrends,
  type HistoricalTrends,
  type SnapshotComparisonPlayer,
  type SnapshotComparisonSnapshot
} from "@atlas/domain";

export interface CalculateClubHistoricalTrendsInput {
  clubId: string;
}

const snapshotRepository = new MongoSnapshotRepository();

export async function calculateClubHistoricalTrends(
  input: CalculateClubHistoricalTrendsInput
): Promise<HistoricalTrends> {
  const snapshots = await snapshotRepository.listByClub(input.clubId);

  if (snapshots.length === 0) {
    throw new Error("No snapshots found for club.");
  }

  return calculateHistoricalTrends(snapshots.map(mapSnapshot));
}

function mapSnapshot(snapshot: PersistedSnapshot): SnapshotComparisonSnapshot {
  return {
    id: snapshot.id,
    clubId: snapshot.clubId,
    snapshotDate: snapshot.snapshotDate.toISOString().slice(0, 10),
    players: snapshot.players.map(mapPlayer)
  };
}

function mapPlayer(player: PersistedPlayerSnapshot): SnapshotComparisonPlayer {
  return {
    id: player.id,
    playerId: player.playerId,
    externalId: player.externalId,
    name: player.name,
    age: player.age,
    wage: player.wage,
    estimatedValue: player.estimatedValue,
    skills: player.skills
  };
}
