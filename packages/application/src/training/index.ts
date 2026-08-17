import {
  MongoClubRepository,
  MongoSnapshotRepository,
  MongoTrainingWeekRepository,
  type PersistedPlayerSnapshot
} from "@atlas/database";
import type { ClubId } from "../types.js";
import type { PlayerTrainingWeekDto } from "../importer/types.js";
import type { TrainingPageData } from "./types.js";

const clubRepository = new MongoClubRepository();
const snapshotRepository = new MongoSnapshotRepository();
const trainingWeekRepository = new MongoTrainingWeekRepository();

export async function getTrainingPageData(clubId: ClubId): Promise<TrainingPageData> {
  const club = await clubRepository.findById(clubId.toString());

  if (!club) {
    throw new Error(`Club not found: ${clubId}`);
  }

  const latestSnapshot = (await snapshotRepository.listByClub(clubId)).at(-1) ?? null;
  const history = await trainingWeekRepository.listByClub(club.clubId);
  const latestByPlayer = new Map<number, (typeof history)[number]>();

  for (const report of history) {
    latestByPlayer.set(report.playerId, report);
  }

  return {
    snapshotId: latestSnapshot?.id ?? null,
    snapshotDate: latestSnapshot?.snapshotDate.toISOString().slice(0, 10) ?? null,
    configuration: club.training,
    players: latestSnapshot?.players.map((player) => mapPlayer(player, latestByPlayer)) ?? [],
    history
  };
}

export async function importTrainingReports(
  clubId: number,
  reports: readonly PlayerTrainingWeekDto[]
): Promise<number> {
  for (const report of reports) {
    await trainingWeekRepository.save({
      clubId,
      playerId: report.playerId,
      gameWeek: report.gameWeek,
      seasonWeek: report.seasonWeek,
      date: report.date,
      type: report.type,
      kind: report.kind,
      intensity: report.intensity,
      age: report.age,
      skills: { ...report.skills },
      skillsChange: { ...report.skillsChange }
    });
  }

  return reports.length;
}

function mapPlayer(
  player: PersistedPlayerSnapshot,
  latestByPlayer: ReadonlyMap<number, TrainingPageData["history"][number]>
): TrainingPageData["players"][number] {
  return {
    id: player.id,
    name: player.name,
    age: player.age,
    form: player.form,
    training: player.training,
    latestReport: latestByPlayer.get(player.playerId) ?? null
  };
}

export * from "./types.js";
