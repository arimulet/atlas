import {
  MongoSnapshotRepository,
  type PersistedPlayerSnapshot,
  type PersistedSnapshot
} from "@atlas/database";
import {
  generateHistoricalFindings,
  type HistoricalFindings,
  type SnapshotComparisonPlayer,
  type SnapshotComparisonSnapshot
} from "@atlas/domain";

export interface GenerateClubHistoricalFindingsInput {
  clubId: string;
}

const snapshotRepository = new MongoSnapshotRepository();

export async function generateClubHistoricalFindings(
  input: GenerateClubHistoricalFindingsInput
): Promise<HistoricalFindings> {
  const snapshots = await snapshotRepository.listByClub(input.clubId);

  if (snapshots.length === 0) {
    throw new Error("No snapshots found for club.");
  }

  return generateHistoricalFindings(snapshots.map(mapSnapshot));
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
