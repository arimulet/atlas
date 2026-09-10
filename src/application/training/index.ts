import {
  MongoClubRepository,
  MongoJuniorRepository,
  MongoPlayerRepository,
  MongoSnapshotRepository,
  MongoTrainingWeekRepository,
  type PersistedJunior,
  type PersistedPlayer,
  type PersistedPlayerSkills,
  type PersistedPlayerSkillsChange,
  type PersistedPlayerSnapshot,
  type PersistedSnapshot,
  type PersistedPlayerTrainingWeek
} from "@atlas/database";
import {
  buildTrainingRecommendations,
  buildWeeklyTrainingCalibrationReport,
  buildWeeklyTrainingReport,
  createTrainingWeek,
  estimateTalentFromTrainingHistory,
  optimizeAdvancedTrainingSlots,
  selectTrainingCalibrationDataset,
  type PlayerSkill,
  type PlayerSkills,
  type PlayerSkillsChange,
  type SkillTrainingCostSkill
} from "@atlas/domain";
import type {
  AdvancedTrainingCandidateContext,
  AdvancedTrainingOptimization,
  PlayerTrainingRecommendation,
  TrainingHistory,
  TrainingCalibrationPlayerContext,
  WeeklyTrainingCalibrationReport,
  WeeklyTrainingReport
} from "@atlas/domain";
import type { ClubId } from "../types.js";
import type { PlayerTrainingWeekDto } from "../importer/types.js";
import type { TrainingPageData, WeeklyTrainingIntelligence } from "./types.js";

const clubRepository = new MongoClubRepository();
const juniorRepository = new MongoJuniorRepository();
const snapshotRepository = new MongoSnapshotRepository();
const trainingWeekRepository = new MongoTrainingWeekRepository();
const playerRepository = new MongoPlayerRepository();

function resolvePlayerPosition(
  player: { position?: string | null } | null | undefined,
  snapshotPlayer?: { observedPosition?: string | null } | null
): AdvancedTrainingCandidateContext["player"]["position"] {
  const rawPosition = player?.position ?? snapshotPlayer?.observedPosition ?? null;
  if (!rawPosition) {
    return null;
  }
  const p = rawPosition.trim().toLowerCase();
  if (p === "gk" || p === "goalkeeper") return "goalkeeper";
  if (p === "def" || p === "defender") return "defender";
  if (p === "mid" || p === "midfielder") return "midfielder";
  if (p === "winger") return "winger";
  if (p === "att" || p === "striker" || p === "forward") return "striker";
  return null;
}
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
const DEFAULT_TRIAL_ADVANCED_PROJECTED_INTENSITY = 100;

const inFlightTrainingPageData = new Map<string, Promise<TrainingPageData>>();
const trainingPageDataCache = new Map<string, { data: TrainingPageData; timestamp: number }>();
const inFlightTrainingIntelligence = new Map<string, Promise<WeeklyTrainingIntelligence>>();
const trainingIntelligenceCache = new Map<string, { data: WeeklyTrainingIntelligence; timestamp: number }>();
const TRAINING_CACHE_TTL_MS = 60_000;

export function invalidateTrainingCache(clubId?: ClubId): void {
  if (clubId) {
    const key = String(clubId);
    trainingPageDataCache.delete(key);
    trainingIntelligenceCache.delete(key);
  } else {
    trainingPageDataCache.clear();
    trainingIntelligenceCache.clear();
  }
}

export async function getTrainingPageData(clubId: ClubId): Promise<TrainingPageData> {
  const cacheKey = String(clubId);
  const cached = trainingPageDataCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < TRAINING_CACHE_TTL_MS) {
    return cached.data;
  }

  const existingInFlight = inFlightTrainingPageData.get(cacheKey);
  if (existingInFlight) {
    return existingInFlight;
  }

  const compute = async (): Promise<TrainingPageData> => {
    const club = await clubRepository.findById(clubId.toString());

    if (!club) {
      throw new Error(`Club not found: ${clubId}`);
    }

    const [snapshots, history] = await Promise.all([
      snapshotRepository.findLatestNByClub(club.clubId, 2),
      trainingWeekRepository.listByClub(club.clubId)
    ]);
    const latestSnapshot = snapshots.at(-1) ?? null;
    const previousSnapshot = snapshots.at(-2) ?? null;
    const latestByPlayer = new Map<number, (typeof history)[number]>();

    for (const report of history) {
      latestByPlayer.set(report.playerId, report);
    }

    const histories = buildTrainingHistories(history);
    const talentByPlayer = new Map<number, ReturnType<typeof estimateTalentFromTrainingHistory>>();
    for (const h of histories) {
      talentByPlayer.set(h.playerId, estimateTalentFromTrainingHistory(h));
    }

    const previousPlayerValues = new Map(
      previousSnapshot?.players.map((previousPlayer) => [
        previousPlayer.playerId,
        previousPlayer.value
      ]) ?? []
    );

    const result: TrainingPageData = {
      snapshotId: latestSnapshot?.id ?? null,
      snapshotDate: latestSnapshot?.snapshotDate.toISOString().slice(0, 10) ?? null,
      configuration: club.training,
      players:
        latestSnapshot?.players.map((player) =>
          mapPlayer(
            player,
            previousPlayerValues.get(player.playerId) ?? null,
            latestByPlayer,
            talentByPlayer.get(player.playerId) ?? null
          )
        ) ?? [],
      history
    };

    trainingPageDataCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  };

  const executionPromise = compute().finally(() => {
    inFlightTrainingPageData.delete(cacheKey);
  });

  inFlightTrainingPageData.set(cacheKey, executionPromise);
  return executionPromise;
}

export function buildWeeklyTrainingReportFromLoadedData(
  reports: PersistedPlayerTrainingWeek[],
  gameWeek?: number
): WeeklyTrainingReport {
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

export async function getWeeklyTrainingReport(
  clubId: ClubId,
  gameWeek?: number
): Promise<WeeklyTrainingReport> {
  const club = await clubRepository.findById(clubId.toString());

  if (!club) {
    throw new Error(`Club not found: ${clubId}`);
  }

  const reports = await trainingWeekRepository.listByClub(club.clubId);
  return buildWeeklyTrainingReportFromLoadedData(reports, gameWeek);
}

export function buildTrainingRecommendationsFromLoadedData(
  reports: PersistedPlayerTrainingWeek[],
  snapshots: PersistedSnapshot[],
  persistedPlayers: PersistedPlayer[],
  gameWeek?: number
): PlayerTrainingRecommendation[] {
  const persistedPlayerMap = new Map(persistedPlayers.map((p) => [p.playerId, p]));
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
  const historyByPlayer = new Map(histories.map((h) => [h.playerId, h]));
  const latestSnapshotPlayerMap = new Map(
    (latestSnapshot?.players ?? []).map((p) => [p.playerId, p])
  );

  return buildTrainingRecommendations(
    weeklyReport.players.flatMap((playerReport) => {
      const history = historyByPlayer.get(playerReport.playerId);
      const currentWeek = history?.weeks.find((week) => week.week === playerReport.gameWeek);
      if (!history || !currentWeek) {
        return [];
      }

      const snapshotPlayer = latestSnapshotPlayerMap.get(playerReport.playerId);
      const persistedPlayer = persistedPlayerMap.get(playerReport.playerId);

      return [
        {
          player: {
            playerId: playerReport.playerId,
            age: currentWeek.playerAge,
            position: resolvePlayerPosition(persistedPlayer, snapshotPlayer),
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

export async function getTrainingRecommendations(
  clubId: ClubId,
  gameWeek?: number
): Promise<PlayerTrainingRecommendation[]> {
  const club = await clubRepository.findById(clubId.toString());

  if (!club) {
    throw new Error(`Club not found: ${clubId}`);
  }

  const [reports, snapshots, persistedPlayers] = await Promise.all([
    trainingWeekRepository.listByClub(club.clubId),
    snapshotRepository.listByClub(club.clubId),
    playerRepository.listByClub(club.clubId)
  ]);
  return buildTrainingRecommendationsFromLoadedData(reports, snapshots, persistedPlayers, gameWeek);
}

export interface PrecomputedTrainingData {
  histories?: TrainingHistory[];
  talentByPlayer?: Map<number, ReturnType<typeof estimateTalentFromTrainingHistory>>;
  weeklyReport?: WeeklyTrainingReport;
  recommendations?: PlayerTrainingRecommendation[];
}

export function buildAdvancedTrainingOptimizationFromLoadedData(
  reports: PersistedPlayerTrainingWeek[],
  snapshots: PersistedSnapshot[],
  juniors: PersistedJunior[],
  persistedPlayers: PersistedPlayer[],
  gameWeek?: number,
  precomputed?: PrecomputedTrainingData
): AdvancedTrainingOptimization {
  const persistedPlayerMap = new Map(persistedPlayers.map((p) => [p.playerId, p]));
  const histories = precomputed?.histories ?? buildTrainingHistories(reports);
  const talentByPlayer =
    precomputed?.talentByPlayer ??
    new Map(
      histories.map((history) => [
        history.playerId,
        estimateTalentFromTrainingHistory(history)
      ])
    );

  const talents = new Map<number, number | null>();
  for (const [playerId, estimate] of talentByPlayer) {
    talents.set(playerId, estimate.value);
  }

  const weeklyReport =
    precomputed?.weeklyReport ??
    buildWeeklyTrainingReport({
      players: histories.map((history) => ({ history })),
      gameWeek,
      talents
    });
  const latestSnapshot = snapshots.at(-1);
  const latestSnapshotPlayerMap = new Map(
    (latestSnapshot?.players ?? []).map((player) => [player.playerId, player])
  );
  const historyByPlayer = new Map(histories.map((h) => [h.playerId, h]));

  const academyTalentByJuniorId = new Map(
    juniors.flatMap((junior) => {
      const talent = academyTalentForPromotedJunior(junior);
      return talent === null ? [] : [[junior.juniorId, talent] as const];
    })
  );
  const academyTalentByJuniorName = new Map(
    juniors.flatMap((junior) => {
      const talent = academyTalentForPromotedJunior(junior);
      return talent === null ? [] : [[normalizePlayerName(junior.name), talent] as const];
    })
  );
  const academyTalentByPlayer = new Map(
    (latestSnapshot?.players ?? []).flatMap((player) => {
      const talent =
        academyTalentByJuniorId.get(player.playerId) ??
        academyTalentByJuniorName.get(normalizePlayerName(player.name));
      return talent === undefined ? [] : [[player.playerId, talent] as const];
    })
  );
  const weeklyReportByPlayer = new Map(
    weeklyReport.players.map((playerReport) => [playerReport.playerId, playerReport])
  );
  const recommendationByPlayer = new Map<number, PlayerTrainingRecommendation>();

  const recommendations =
    precomputed?.recommendations ??
    buildTrainingRecommendations(
      weeklyReport.players.flatMap((playerReport) => {
        const history = historyByPlayer.get(playerReport.playerId);
        const currentWeek = history?.weeks.find((week) => week.week === playerReport.gameWeek);
        if (!history || !currentWeek) {
          return [];
        }

        const snapshotPlayer = latestSnapshotPlayerMap.get(playerReport.playerId);
        const persistedPlayer = persistedPlayerMap.get(playerReport.playerId);

        return [
          {
            player: {
              playerId: playerReport.playerId,
              age: currentWeek.playerAge,
              position: resolvePlayerPosition(persistedPlayer, snapshotPlayer),
              skills: currentWeek.skills
            },
            weeklyReport: playerReport,
            trainingHistory: history,
            talent: talentByPlayer.get(playerReport.playerId) ?? null
          }
        ];
      })
    );

  recommendations.forEach((recommendation) => {
    recommendationByPlayer.set(recommendation.playerId, recommendation);
  });

  const historicalContexts: AdvancedTrainingCandidateContext[] = histories.flatMap((history) => {
    const currentWeek = history.weeks.find((week) => week.week === weeklyReport.gameWeek);
    if (!currentWeek) {
      return [];
    }

    const snapshotPlayer = latestSnapshotPlayerMap.get(history.playerId);
    const persistedPlayer = persistedPlayerMap.get(history.playerId);
    const academyTalent = academyTalentByPlayer.get(history.playerId);
    const seniorTalent = talentByPlayer.get(history.playerId);
    const hasObservedSeniorTalent =
      seniorTalent?.value !== null && seniorTalent?.value !== undefined;
    const isTrialCandidate =
      validSeniorTrainingWeekCount(history) < 2 ||
      (academyTalent !== undefined && !hasObservedSeniorTalent);
    const projectedIntensity =
      currentWeek.intensity > 0
        ? currentWeek.intensity
        : DEFAULT_TRIAL_ADVANCED_PROJECTED_INTENSITY;
    return [
      {
        player: {
          playerId: history.playerId,
          age: currentWeek.playerAge,
          position:
            resolvePlayerPosition(persistedPlayer, snapshotPlayer) ??
            (snapshotPlayer
              ? trialPositionForTrainingPosition(snapshotPlayer.training.position)
              : null),
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
        talent: talentByPlayer.get(history.playerId) ?? null,
        ...(isTrialCandidate
          ? {
              trial: {
                projectedIntensity,
                ...(academyTalent !== undefined ? { academyTalent: academyTalent ?? null } : {})
              }
            }
          : {})
      }
    ];
  });
  const historicalPlayerIds = new Set(historicalContexts.map((context) => context.player.playerId));
  const trialContexts: AdvancedTrainingCandidateContext[] = (latestSnapshot?.players ?? [])
    .filter((player) => {
      const history = historyByPlayer.get(player.playerId);
      return (
        !historicalPlayerIds.has(player.playerId) &&
        validSeniorTrainingWeekCount(history ?? null) < 2
      );
    })
    .map((player) =>
      buildSnapshotTrialContext({
        player,
        trainingHistory: historyByPlayer.get(player.playerId) ?? {
          playerId: player.playerId,
          weeks: []
        },
        academyTalent: academyTalentByPlayer.get(player.playerId)
      })
    );
  const contexts = [...historicalContexts, ...trialContexts];

  return optimizeAdvancedTrainingSlots(contexts, weeklyReport.gameWeek ?? undefined);
}

export async function getAdvancedTrainingOptimization(
  clubId: ClubId,
  gameWeek?: number
): Promise<AdvancedTrainingOptimization> {
  const club = await clubRepository.findById(clubId.toString());

  if (!club) {
    throw new Error(`Club not found: ${clubId}`);
  }

  const [reports, snapshots, juniors, persistedPlayers] = await Promise.all([
    trainingWeekRepository.listByClub(club.clubId),
    snapshotRepository.listByClub(club.clubId),
    juniorRepository.listByClub(club.clubId),
    playerRepository.listByClub(club.clubId)
  ]);
  return buildAdvancedTrainingOptimizationFromLoadedData(reports, snapshots, juniors, persistedPlayers, gameWeek);
}

export function buildWeeklyTrainingIntelligenceFromLoadedData(
  reports: PersistedPlayerTrainingWeek[],
  snapshots: PersistedSnapshot[],
  juniors: PersistedJunior[],
  persistedPlayers: PersistedPlayer[],
  gameWeek?: number
): WeeklyTrainingIntelligence {
  const persistedPlayerMap = new Map(persistedPlayers.map((p) => [p.playerId, p]));
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
  const historyByPlayer = new Map(histories.map((h) => [h.playerId, h]));
  const latestSnapshotPlayerMap = new Map(
    (latestSnapshot?.players ?? []).map((p) => [p.playerId, p])
  );

  const recommendations = buildTrainingRecommendations(
    weeklyReport.players.flatMap((playerReport) => {
      const history = historyByPlayer.get(playerReport.playerId);
      const currentWeek = history?.weeks.find((week) => week.week === playerReport.gameWeek);
      if (!history || !currentWeek) {
        return [];
      }

      const snapshotPlayer = latestSnapshotPlayerMap.get(playerReport.playerId);
      const persistedPlayer = persistedPlayerMap.get(playerReport.playerId);

      return [
        {
          player: {
            playerId: playerReport.playerId,
            age: currentWeek.playerAge,
            position: resolvePlayerPosition(persistedPlayer, snapshotPlayer),
            skills: currentWeek.skills
          },
          weeklyReport: playerReport,
          trainingHistory: history,
          talent: talentByPlayer.get(playerReport.playerId) ?? null
        }
      ];
    })
  );

  const advancedOptimization = buildAdvancedTrainingOptimizationFromLoadedData(
    reports,
    snapshots,
    juniors,
    persistedPlayers,
    gameWeek,
    {
      histories,
      talentByPlayer,
      weeklyReport,
      recommendations
    }
  );

  return { report: weeklyReport, recommendations, advancedOptimization };
}

export async function getWeeklyTrainingIntelligence(
  clubId: ClubId
): Promise<WeeklyTrainingIntelligence> {
  const cacheKey = String(clubId);
  const cached = trainingIntelligenceCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < TRAINING_CACHE_TTL_MS) {
    return cached.data;
  }

  const existingInFlight = inFlightTrainingIntelligence.get(cacheKey);
  if (existingInFlight) {
    return existingInFlight;
  }

  const compute = async (): Promise<WeeklyTrainingIntelligence> => {
    const club = await clubRepository.findById(clubId.toString());

    if (!club) {
      throw new Error(`Club not found: ${clubId}`);
    }

    const [reports, snapshots, juniors, persistedPlayers] = await Promise.all([
      trainingWeekRepository.listByClub(club.clubId),
      snapshotRepository.listByClub(club.clubId),
      juniorRepository.listByClub(club.clubId),
      playerRepository.listByClub(club.clubId)
    ]);

    const result = buildWeeklyTrainingIntelligenceFromLoadedData(
      reports,
      snapshots,
      juniors,
      persistedPlayers
    );

    trainingIntelligenceCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  };

  const executionPromise = compute().finally(() => {
    inFlightTrainingIntelligence.delete(cacheKey);
  });

  inFlightTrainingIntelligence.set(cacheKey, executionPromise);
  return executionPromise;
}

export async function getWeeklyTrainingCalibration(
  clubId: ClubId,
  gameWeek?: number
): Promise<WeeklyTrainingCalibrationReport> {
  const club = await clubRepository.findById(clubId.toString());
  if (!club) {
    throw new Error(`Club not found: ${clubId}`);
  }

  const [reports, snapshots, persistedPlayers] = await Promise.all([
    trainingWeekRepository.listByClub(club.clubId),
    snapshotRepository.listByClub(club.clubId),
    playerRepository.listByClub(club.clubId)
  ]);
  const persistedPlayerMap = new Map(persistedPlayers.map((p) => [p.playerId, p]));
  const histories = buildTrainingHistories(reports);
  const talentByPlayer = new Map<number, ReturnType<typeof estimateTalentFromTrainingHistory>>();
  for (const history of histories) {
    talentByPlayer.set(history.playerId, estimateTalentFromTrainingHistory(history));
  }

  const talents = new Map<number, number | null>();
  for (const [playerId, talent] of talentByPlayer) {
    talents.set(playerId, talent.value);
  }
  const weeklyReport = buildWeeklyTrainingReport({
    players: histories.map((history) => ({ history })),
    gameWeek,
    talents
  });
  const latestSnapshot = snapshots.at(-1);
  const latestSnapshotPlayerMap = new Map(
    (latestSnapshot?.players ?? []).map((p) => [p.playerId, p])
  );
  const reportByPlayer = new Map(
    weeklyReport.players.map((playerReport) => [playerReport.playerId, playerReport])
  );
  const recommendationContexts = histories.flatMap((history) => {
    const currentWeek = history.weeks.find((week) => week.week === weeklyReport.gameWeek);
    const report = reportByPlayer.get(history.playerId);
    if (!currentWeek || !report) {
      return [];
    }
    const snapshotPlayer = latestSnapshotPlayerMap.get(history.playerId);
    const persistedPlayer = persistedPlayerMap.get(history.playerId);
    return [
      {
        player: {
          playerId: history.playerId,
          age: currentWeek.playerAge,
          position: resolvePlayerPosition(persistedPlayer, snapshotPlayer),
          skills: currentWeek.skills
        },
        weeklyReport: report,
        trainingHistory: history,
        talent: talentByPlayer.get(history.playerId) ?? null
      }
    ];
  });
  const recommendations = buildTrainingRecommendations(recommendationContexts);
  const recommendationByPlayer = new Map(
    recommendations.map((recommendation) => [recommendation.playerId, recommendation])
  );
  const advancedContexts = recommendationContexts.flatMap((context) => {
    const snapshotPlayer = latestSnapshotPlayerMap.get(context.player.playerId);
    const currentWeek = context.trainingHistory.weeks.find(
      (week) => week.week === weeklyReport.gameWeek
    );
    if (!currentWeek) {
      return [];
    }
    return [
      {
        ...context,
        trainingRecommendation: recommendationByPlayer.get(context.player.playerId),
        currentTraining: {
          skill: currentWeek.skill,
          kind: snapshotPlayer
            ? snapshotPlayer.training.advanced
              ? ("advanced" as const)
              : ("formation" as const)
            : currentWeek.kind === "missing"
              ? ("formation" as const)
              : currentWeek.kind,
          intensity: currentWeek.intensity
        }
      }
    ];
  });
  const advancedOptimization = optimizeAdvancedTrainingSlots(
    advancedContexts,
    weeklyReport.gameWeek
  );
  const calibrationPlayers: TrainingCalibrationPlayerContext[] = advancedContexts.map(
    (context) => ({
      player: context.player,
      trainingHistory: context.trainingHistory,
      currentTraining: context.currentTraining,
      currentlyAdvanced: context.currentTraining.kind === "advanced"
    })
  );

  const datasetSelection = selectTrainingCalibrationDataset(calibrationPlayers);
  return buildWeeklyTrainingCalibrationReport({
    players: datasetSelection.players,
    datasetSelection,
    gameWeek: weeklyReport.gameWeek,
    weeklyReport,
    recommendations,
    advancedOptimization
  });
}

function buildTrainingHistories(
  reports: readonly TrainingPageData["history"][number][]
): TrainingHistory[] {
  const weeksByPlayer = new Map<number, Array<ReturnType<typeof createTrainingWeek>>>();

  for (const report of reports) {
    let playerWeeks = weeksByPlayer.get(report.playerId);
    if (!playerWeeks) {
      playerWeeks = [];
      weeksByPlayer.set(report.playerId, playerWeeks);
    }
    playerWeeks.push(
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
      skills: toPersistedSkills(report.skills),
      skillsChange: toPersistedSkillsChange(report.skillsChange)
    });
  }

  return reports.length;
}

function toPersistedSkills(skills: PlayerTrainingWeekDto["skills"]): PersistedPlayerSkills {
  return {
    stamina: skills.stamina,
    keeper: skills.keeper,
    playmaking: skills.playmaking,
    passing: skills.passing,
    technique: skills.technique,
    defending: skills.defending,
    striker: skills.striker,
    pace: skills.pace
  };
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
  previousValue: number | null,
  latestByPlayer: ReadonlyMap<number, TrainingPageData["history"][number]>,
  talentEstimate: ReturnType<typeof estimateTalentFromTrainingHistory> | null
): TrainingPageData["players"][number] {
  return {
    id: player.id,
    playerId: player.playerId,
    name: player.name,
    countryName: player.countryName,
    age: player.age,
    form: player.form,
    training: player.training,
    value: player.value,
    valueChange: previousValue === null ? null : player.value - previousValue,
    latestReport: latestByPlayer.get(player.playerId) ?? null,
    talentEstimate
  };
}

export * from "./types.js";

function trialPositionForTrainingPosition(
  position: number
): AdvancedTrainingCandidateContext["player"]["position"] {
  if (position === 0) return "goalkeeper";
  if (position === 1) return "defender";
  if (position === 3) return "striker";
  if (position === 2) return "midfielder";
  return null;
}

function trialSkillForTrainingPosition(position: number): SkillTrainingCostSkill | null {
  if (position === 0) return "keeper";
  if (position === 1) return "defending";
  if (position === 2) return "playmaking";
  if (position === 3) return "scoring";
  return null;
}

function buildSnapshotTrialContext(input: {
  player: PersistedPlayerSnapshot;
  trainingHistory: TrainingHistory;
  academyTalent: number | undefined;
}): AdvancedTrainingCandidateContext {
  const position = trialPositionForTrainingPosition(input.player.training.position);
  const skill = trialSkillForTrainingPosition(input.player.training.position);
  const hasTrainingTarget = position !== null && skill !== null;

  return {
    player: {
      playerId: input.player.playerId,
      age: input.player.age,
      position,
      skills: toDomainSnapshotSkills(input.player.skills)
    },
    trainingHistory: input.trainingHistory,
    currentTraining: {
      skill: skill ?? "stamina",
      kind: hasTrainingTarget
        ? input.player.training.advanced
          ? "advanced"
          : "formation"
        : "missing",
      intensity: 0
    },
    ...(hasTrainingTarget
      ? {
          trial: {
            projectedIntensity: DEFAULT_TRIAL_ADVANCED_PROJECTED_INTENSITY,
            ...(input.academyTalent !== undefined ? { academyTalent: input.academyTalent } : {})
          }
        }
      : {})
  };
}

function toDomainSnapshotSkills(skills: PersistedPlayerSnapshot["skills"]): PlayerSkills {
  const domainSkills: PlayerSkills = {};
  if (skills.stamina !== null) domainSkills.stamina = skills.stamina;
  if (skills.pace !== null) domainSkills.pace = skills.pace;
  if (skills.technique !== null) domainSkills.technique = skills.technique;
  if (skills.passing !== null) domainSkills.passing = skills.passing;
  if (skills.keeper !== null) domainSkills.keeper = skills.keeper;
  if (skills.defender !== null) domainSkills.defending = skills.defender;
  if (skills.playmaker !== null) domainSkills.playmaking = skills.playmaker;
  if (skills.striker !== null) domainSkills.striker = skills.striker;
  return domainSkills;
}

function normalizePlayerName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLocaleLowerCase();
}
function academyTalentForPromotedJunior(junior: PersistedJunior): number | null {
  if (
    junior.status !== "promoted" ||
    junior.currentLevel <= junior.initialLevel ||
    junior.initialWeeks <= junior.weeksLeft
  ) {
    return null;
  }

  const talent =
    (junior.initialWeeks - junior.weeksLeft) / (junior.currentLevel - junior.initialLevel);
  return Number.isFinite(talent) && talent > 0 ? talent : null;
}

function validSeniorTrainingWeekCount(history: TrainingHistory | null): number {
  if (!history) {
    return 0;
  }

  return history.weeks.filter(
    (week) =>
      (week.kind === "advanced" || week.kind === "formation") &&
      week.intensity !== undefined &&
      week.intensity > 0
  ).length;
}
