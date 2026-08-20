import {
  MongoClubRepository,
  MongoSnapshotRepository,
  MongoTrainingWeekRepository,
  type PersistedPlayerSkills,
  type PersistedPlayerSkillsChange,
  type PersistedPlayerSnapshot
} from "@atlas/database";
import {
  buildTrainingRecommendations,
  buildWeeklyTrainingReport,
  createTrainingWeek,
  estimateTalentFromTrainingHistory,
  optimizeAdvancedTrainingSlots,
  type PlayerSkill,
  type PlayerSkills,
  type PlayerSkillsChange
} from "@atlas/domain";
import type {
  AdvancedTrainingCandidateContext,
  AdvancedTrainingOptimization,
  PlayerTrainingRecommendation,
  TrainingHistory,
  WeeklyTrainingReport
} from "@atlas/domain";
import type { ClubId } from "../types.js";
import type { PlayerTrainingWeekDto } from "../importer/types.js";
import type { TrainingPageData, WeeklyTrainingIntelligence } from "./types.js";

const clubRepository = new MongoClubRepository();
const snapshotRepository = new MongoSnapshotRepository();
const trainingWeekRepository = new MongoTrainingWeekRepository();
const DOMAIN_PLAYER_SKILLS: readonly PlayerSkill[] = [
  "stamina",
  "keeper",
  "playmaking",
  "passing",
  "technique",
  "defending",
  "striker",
  "pace"
];

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
          skills: toDomainSkills(report.skills),
          skillsChange: toDomainSkillsChange(report.skillsChange)
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

export async function getWeeklyTrainingReport(
  clubId: ClubId,
  gameWeek?: number
): Promise<WeeklyTrainingReport> {
  const club = await clubRepository.findById(clubId.toString());

  if (!club) {
    throw new Error(`Club not found: ${clubId}`);
  }

  const reports = await trainingWeekRepository.listByClub(club.clubId);
  const histories = buildTrainingHistories(reports);
  const talents = new Map<number, number | null>();

  for (const history of histories) {
    talents.set(history.playerId, estimateTalentFromTrainingHistory(history).value);
  }

  return buildWeeklyTrainingReport({
    players: histories.map((history) => ({ history })),
    gameWeek,
    talents
  });
}

export async function getTrainingRecommendations(
  clubId: ClubId,
  gameWeek?: number
): Promise<PlayerTrainingRecommendation[]> {
  const club = await clubRepository.findById(clubId.toString());

  if (!club) {
    throw new Error(`Club not found: ${clubId}`);
  }

  const [reports, snapshots] = await Promise.all([
    trainingWeekRepository.listByClub(club.clubId),
    snapshotRepository.listByClub(clubId)
  ]);
  const histories = buildTrainingHistories(reports);
  const talentByPlayer = new Map<number, ReturnType<typeof estimateTalentFromTrainingHistory>>();

  for (const history of histories) {
    talentByPlayer.set(history.playerId, estimateTalentFromTrainingHistory(history));
  }

  const talents = new Map<number, number | null>();
  for (const [playerId, estimate] of talentByPlayer) {
    talents.set(playerId, estimate.value);
  }

  const weeklyReport = buildWeeklyTrainingReport({
    players: histories.map((history) => ({ history })),
    gameWeek,
    talents
  });
  const latestSnapshot = snapshots.at(-1);

  return buildTrainingRecommendations(
    weeklyReport.players.flatMap((playerReport) => {
      const history = histories.find((candidate) => candidate.playerId === playerReport.playerId);
      const currentWeek = history?.weeks.find((week) => week.week === playerReport.gameWeek);
      if (!history || !currentWeek) {
        return [];
      }

      const snapshotPlayer = latestSnapshot?.players.find(
        (player) => player.playerId === playerReport.playerId
      );

      return [
        {
          player: {
            playerId: playerReport.playerId,
            age: currentWeek.playerAge,
            position: snapshotPlayer?.observedPosition ?? null,
            skills: currentWeek.skills
          },
          weeklyReport: playerReport,
          trainingHistory: history,
          talent: talentByPlayer.get(playerReport.playerId) ?? null
        }
      ];
    })
  );
}

export async function getAdvancedTrainingOptimization(
  clubId: ClubId,
  gameWeek?: number
): Promise<AdvancedTrainingOptimization> {
  const club = await clubRepository.findById(clubId.toString());

  if (!club) {
    throw new Error(`Club not found: ${clubId}`);
  }

  const [reports, snapshots] = await Promise.all([
    trainingWeekRepository.listByClub(club.clubId),
    snapshotRepository.listByClub(clubId)
  ]);
  const histories = buildTrainingHistories(reports);
  const talentByPlayer = new Map<number, ReturnType<typeof estimateTalentFromTrainingHistory>>();

  for (const history of histories) {
    talentByPlayer.set(history.playerId, estimateTalentFromTrainingHistory(history));
  }

  const talents = new Map<number, number | null>();
  for (const [playerId, estimate] of talentByPlayer) {
    talents.set(playerId, estimate.value);
  }

  const weeklyReport = buildWeeklyTrainingReport({
    players: histories.map((history) => ({ history })),
    gameWeek,
    talents
  });
  const latestSnapshot = snapshots.at(-1);
  const weeklyReportByPlayer = new Map(
    weeklyReport.players.map((playerReport) => [playerReport.playerId, playerReport])
  );
  const recommendationByPlayer = new Map<number, PlayerTrainingRecommendation>();

  buildTrainingRecommendations(
    weeklyReport.players.flatMap((playerReport) => {
      const history = histories.find((candidate) => candidate.playerId === playerReport.playerId);
      const currentWeek = history?.weeks.find((week) => week.week === playerReport.gameWeek);
      if (!history || !currentWeek) {
        return [];
      }

      const snapshotPlayer = latestSnapshot?.players.find(
        (player) => player.playerId === playerReport.playerId
      );

      return [
        {
          player: {
            playerId: playerReport.playerId,
            age: currentWeek.playerAge,
            position: snapshotPlayer?.observedPosition ?? null,
            skills: currentWeek.skills
          },
          weeklyReport: playerReport,
          trainingHistory: history,
          talent: talentByPlayer.get(playerReport.playerId) ?? null
        }
      ];
    })
  ).forEach((recommendation) => {
    recommendationByPlayer.set(recommendation.playerId, recommendation);
  });

  const contexts: AdvancedTrainingCandidateContext[] = histories.flatMap((history) => {
    const currentWeek = history.weeks.find((week) => week.week === weeklyReport.gameWeek);
    if (!currentWeek) {
      return [];
    }

    const snapshotPlayer = latestSnapshot?.players.find(
      (player) => player.playerId === history.playerId
    );
    return [
      {
        player: {
          playerId: history.playerId,
          age: currentWeek.playerAge,
          position: snapshotPlayer?.observedPosition ?? null,
          skills: currentWeek.skills
        },
        weeklyReport: weeklyReportByPlayer.get(history.playerId),
        trainingRecommendation: recommendationByPlayer.get(history.playerId),
        trainingHistory: history,
        currentTraining: {
          skill: currentWeek.skill,
          kind: snapshotPlayer
            ? snapshotPlayer.training.advanced
              ? "advanced"
              : "formation"
            : currentWeek.kind,
          intensity: currentWeek.intensity
        },
        talent: talentByPlayer.get(history.playerId) ?? null
      }
    ];
  });

  return optimizeAdvancedTrainingSlots(contexts, weeklyReport.gameWeek);
}

export async function getWeeklyTrainingIntelligence(
  clubId: ClubId
): Promise<WeeklyTrainingIntelligence> {
  const [report, recommendations, advancedOptimization] = await Promise.all([
    getWeeklyTrainingReport(clubId),
    getTrainingRecommendations(clubId),
    getAdvancedTrainingOptimization(clubId)
  ]);

  return { report, recommendations, advancedOptimization };
}

function buildTrainingHistories(
  reports: readonly TrainingPageData["history"][number][]
): TrainingHistory[] {
  const weeksByPlayer = new Map<number, TrainingHistory["weeks"]>();

  for (const report of reports) {
    const playerWeeks = weeksByPlayer.get(report.playerId) ?? [];
    weeksByPlayer.set(report.playerId, [
      ...playerWeeks,
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
        skills: toDomainSkills(report.skills),
        skillsChange: toDomainSkillsChange(report.skillsChange)
      })
    ]);
  }

  return [...weeksByPlayer.entries()].map(([playerId, weeks]) => ({ playerId, weeks }));
}

function toDomainSkills(skills: PersistedPlayerSkills): PlayerSkills {
  const domainSkills: PlayerSkills = {};

  for (const skill of DOMAIN_PLAYER_SKILLS) {
    const value = skills[skill];
    if (value !== undefined) {
      domainSkills[skill] = value;
    }
  }

  return domainSkills;
}

function toDomainSkillsChange(change: PersistedPlayerSkillsChange): PlayerSkillsChange {
  const domainChange: PlayerSkillsChange = {
    up: change.up,
    down: change.down
  };

  for (const skill of DOMAIN_PLAYER_SKILLS) {
    const value = change[skill];
    if (value !== undefined) {
      domainChange[skill] = value;
    }
  }

  return domainChange;
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
      skillsChange: toPersistedSkillsChange(report.skillsChange)
    });
  }

  return reports.length;
}

function toPersistedSkillsChange(
  change: PlayerTrainingWeekDto["skillsChange"]
): PersistedPlayerSkillsChange {
  return {
    stamina: change.stamina,
    keeper: change.keeper,
    playmaking: change.playmaking,
    passing: change.passing,
    technique: change.technique,
    defending: change.defending,
    striker: change.striker,
    pace: change.pace,
    up: change.up,
    down: change.down
  };
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
