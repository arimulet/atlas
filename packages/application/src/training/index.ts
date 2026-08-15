import {
  MongoClubRepository,
  MongoSnapshotRepository,
  type PersistedPlayerSnapshot
} from "@atlas/database";
import type { ClubId } from "../types.js";
import type { TrainingPageData } from "./types.js";

const clubRepository = new MongoClubRepository();
const snapshotRepository = new MongoSnapshotRepository();

export async function getTrainingPageData(clubId: ClubId): Promise<TrainingPageData> {
  const club = await clubRepository.findById(clubId.toString());

  if (!club) {
    throw new Error(`Club not found: ${clubId}`);
  }

  const latestSnapshot = (await snapshotRepository.listByClub(clubId)).at(-1) ?? null;

  return {
    snapshotId: latestSnapshot?.id ?? null,
    snapshotDate: latestSnapshot?.snapshotDate.toISOString().slice(0, 10) ?? null,
    configuration: club.training,
    players: latestSnapshot?.players.map(mapPlayer) ?? []
  };
}

function mapPlayer(player: PersistedPlayerSnapshot): TrainingPageData["players"][number] {
  return {
    id: player.id,
    name: player.name,
    age: player.age,
    form: player.form,
    training: player.training
  };
}

export * from "./types.js";
