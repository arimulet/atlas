import {
  MongoClubRepository,
  MongoSnapshotRepository,
  MongoTrainingWeekRepository,
  type PersistedPlayerSnapshot
} from "@atlas/database";
import { createTrainingWeek, estimateTalentFromTrainingHistory } from "@atlas/domain";
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

  const talentByPlayer = new Map<number, ReturnType<typeof estimateTalentFromTrainingHistory>>();
  for (const playerId of new Set(history.map((report) => report.playerId))) {
    const playerWeeks = history
      .filter((report) => report.playerId === playerId)
      .map((report) =>
        createTrainingWeek({
          playerId: report.playerId,
          gameWeek: report.gameWeek,
          season: report.season ?? undefined,
          seasonWeek: report.seasonWeek,
          date: new Date(report.date),
          type: report.type,
          kind: report.kind,
          intensity: report.intensity,
          age: report.age,
          skills: report.skills,
          skillsChange: report.skillsChange
        })
      );
    talentByPlayer.set(
      playerId,
      estimateTalentFromTrainingHistory({ playerId, weeks: playerWeeks })
    );
  }

  return {
    snapshotId: latestSnapshot?.id ?? null,
    snapshotDate: latestSnapshot?.snapshotDate.toISOString().slice(0, 10) ?? null,
    configuration: club.training,
    players:
      latestSnapshot?.players.map((player) =>
        mapPlayer(player, latestByPlayer, talentByPlayer.get(player.playerId) ?? null)
      ) ?? [],
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
      season: report.season,
      seasonWeek: report.seasonWeek,
      date: new Date(report.date),
      type: report.trainedSkill,
      kind: report.kind,
      intensity: report.intensity,
      age: report.age,
      skills: { ...report.skills },
      skillsChange: { ...report.skillsChange },
      skillChanges: report.skillChanges.map((change) => ({ ...change }))
    });
  }

  return reports.length;
}

function mapPlayer(
  player: PersistedPlayerSnapshot,
  latestByPlayer: ReadonlyMap<number, TrainingPageData["history"][number]>,
  talentEstimate: ReturnType<typeof estimateTalentFromTrainingHistory> | null
): TrainingPageData["players"][number] {
  return {
    id: player.id,
    name: player.name,
    age: player.age,
    form: player.form,
    training: player.training,
    latestReport: latestByPlayer.get(player.playerId) ?? null,
    talentEstimate
  };
}

export * from "./types.js";
