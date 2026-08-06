import {
  MongoSnapshotRepository,
  type PersistedSnapshot,
  type PersistedPlayerSnapshot
} from "@atlas/database";
import {
  compareSnapshots,
  type SnapshotComparison,
  type SnapshotComparisonPlayer,
  type SnapshotComparisonSnapshot
} from "@atlas/domain";

export interface CompareClubSnapshotsInput {
  clubId: string;
  baseSnapshotId?: string;
  targetSnapshotId?: string;
  baseSnapshotDate?: string;
  targetSnapshotDate?: string;
}

const snapshotRepository = new MongoSnapshotRepository();

export async function compareClubSnapshots(
  input: CompareClubSnapshotsInput
): Promise<SnapshotComparison> {
  const [baseSnapshot, targetSnapshot] = await Promise.all([
    resolveSnapshot(input.clubId, input.baseSnapshotId, input.baseSnapshotDate, "base"),
    resolveSnapshot(input.clubId, input.targetSnapshotId, input.targetSnapshotDate, "target")
  ]);

  return compareSnapshots(mapSnapshot(baseSnapshot), mapSnapshot(targetSnapshot));
}

export async function listClubSnapshots(clubId: string): Promise<
  Array<{
    id: string;
    clubId: string;
    snapshotDate: string;
    importedAt: string;
    playerCount: number;
  }>
> {
  const snapshots = await snapshotRepository.listByClub(clubId);

  return snapshots.map((snapshot) => ({
    id: snapshot.id,
    clubId: snapshot.clubId,
    snapshotDate: toDateOnly(snapshot.snapshotDate),
    importedAt: snapshot.importedAt.toISOString(),
    playerCount: snapshot.players.length
  }));
}

async function resolveSnapshot(
  clubId: string,
  snapshotId: string | undefined,
  snapshotDate: string | undefined,
  role: "base" | "target"
): Promise<PersistedSnapshot> {
  if (snapshotId) {
    const snapshot = await snapshotRepository.findById(snapshotId);

    if (!snapshot || snapshot.clubId !== clubId) {
      throw new Error(`${role} snapshot not found for club.`);
    }

    return snapshot;
  }

  if (!snapshotDate) {
    throw new Error(`${role} snapshot id or date is required.`);
  }

  const snapshots = await snapshotRepository.findByClubAndDate(
    clubId,
    new Date(`${snapshotDate}T00:00:00.000Z`)
  );

  if (snapshots.length === 0) {
    throw new Error(`${role} snapshot not found for date ${snapshotDate}.`);
  }

  if (snapshots.length > 1) {
    throw new Error(`${role} snapshot date ${snapshotDate} is ambiguous; use snapshot id.`);
  }

  return snapshots[0]!;
}

function mapSnapshot(snapshot: PersistedSnapshot): SnapshotComparisonSnapshot {
  return {
    id: snapshot.id,
    clubId: snapshot.clubId,
    snapshotDate: toDateOnly(snapshot.snapshotDate),
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

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
