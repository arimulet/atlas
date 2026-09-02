import {
  MongoClubRepository,
  MongoSnapshotRepository,
  MongoPlayerRepository,
  MongoTrainingWeekRepository,
  type PersistedPlayerSnapshot,
  type PersistedPlayerDevelopmentOverride,
  type PersistedPlayerTrainingWeek,
  type PersistedSquadRoleAssignment,
  type SaveSquadRoleAssignmentInput,
  findFinalMarketTransfersUpToDate,
  MongoCountryRepository
} from "@atlas/database";
import {
  assessSquad,
  analyzeSquadDepth,
  generateSquadPlanningRecommendations,
  generatePlayerTrainingPath,
  PlayerDevelopmentPlanner,
  projectDevelopment,
  buildWeeklyTrainingReport,
  estimateTalentFromTrainingHistory,
  type DevelopmentCurrentSkillProgress,
  type DevelopmentPlayer,
  type PlayerDevelopmentTargetOverride,
  type SquadPlayerContext,
  type SquadRoleAssignment,
  type SquadDepthAnalysis,
  type SquadDepthPlayer,
  type SquadPlanningRecommendations,
  type TrainingHistory
} from "@atlas/domain";
import {
  calibratePlayerMarketValue,
  compareAdvancedAndFormationMarketValue,
  PLAYER_MARKET_VALUE_COMPARISON_HORIZON_WEEKS,
  projectPlayerMarketValue,
  type PlayerMarketValuePlayerInput
} from "@atlas/domain";
import { createTrainingWeek, type PlayerSkills, type PlayerSkillsChange } from "@atlas/domain";
import type { ClubId } from "../types.js";
import type { SquadAssessmentData } from "./types.js";

export type {
  PlayerLifecycleStage,
  ProfileDepthAssessment,
  ProfileDepthSnapshot,
  ProfileDependencyRisk,
  ProfileSuccessionAssessment,
  ProfileDepthStatus,
  SquadDepthAnalysisConfig,
  SquadDepthAnalysisInput,
  SquadDepthAnalysisOptions,
  SquadDepthReason,
  SquadPlanningHorizon,
  SquadPlanningCandidate,
  SquadPlanningConflict,
  SquadPlanningReason,
  SquadPlanningRecommendation,
  SquadPlanningRecommendationConfig,
  SquadPlanningRecommendationPriority,
  SquadPlanningRecommendationType,
  SquadPlanningRecommendationsInput,
  SquadNeed,
  SquadProfileRequirement,
  SuccessionCandidate,
  SuccessionCoverageStatus,
  SuccessionReadiness,
  SquadAssessment,
  SquadContributionMetrics,
  SquadPlayerAssessment,
  SquadPlayerContext,
  SquadPlanningConfig,
  SquadRole,
  SquadRoleAssignment,
  SquadRoleReason
} from "@atlas/domain";
export type { SquadDepthAnalysis } from "@atlas/domain";
export type { SquadPlanningRecommendations } from "@atlas/domain";

const clubRepository = new MongoClubRepository();
const snapshotRepository = new MongoSnapshotRepository();
const trainingWeekRepository = new MongoTrainingWeekRepository();
const playerRepository = new MongoPlayerRepository();

export async function getSquadAssessment(clubId: ClubId): Promise<SquadAssessmentData> {
  const club = await clubRepository.findById(clubId.toString());
  if (!club) throw new Error(`Club not found: ${clubId}`);

  const [snapshots, trainingWeeks, assignments] = await Promise.all([
    snapshotRepository.listByClub(clubId),
    trainingWeekRepository.listByClub(club.clubId),
    playerRepository.listSquadRoles(club.clubId)
  ]);
  const latest = snapshots.at(-1);
  if (!latest) {
    return {
      players: [],
      summary: { core: 0, developing: 0, prospect: 0, rotation: 0, depth: 0, transition: 0 },
      manualAssignments: assignments.map(mapAssignment),
      currentGameWeek: null,
      depthPlayers: []
    };
  }

  const histories = buildTrainingHistories(trainingWeeks);
  const assignmentsByPlayer = new Map(
    assignments.map((assignment) => [assignment.playerId, assignment])
  );
  const overrides = new Map(
    await Promise.all(
      latest.players.map(
        async (player) =>
          [
            player.playerId,
            await playerRepository.findDevelopmentOverride({
              playerId: player.playerId,
              clubId: club.clubId
            })
          ] as const
      )
    )
  );
  const contexts = latest.players.map((player) =>
    buildPlayerContext(
      player,
      histories.get(player.playerId) ?? null,
      overrides.get(player.playerId) ?? null,
      assignmentsByPlayer.get(player.playerId) ?? null,
      latest.gameWeek,
      latest.snapshotDate
    )
  );

  const countryRepo = new MongoCountryRepository();
  const allCountries = await countryRepo.getAll();
  const clubCountry = allCountries.find(c => c.currencyName === club.currency || c.countryId === club.country);
  const currencyRate = clubCountry?.currencyRate ?? 1;
  const currencyName = clubCountry?.currencyName ?? club.currency;

  const rawTransfers = await findFinalMarketTransfersUpToDate(new Date());
  const mappedTransfers = rawTransfers.map(t => mapMarketTransferToRecord(t, currencyName, currencyRate));

  const assessment = assessSquad(contexts);
  const contextByPlayer = new Map(contexts.map((context) => [context.playerId, context]));
  const marketValues = createMarketValues(contexts, mappedTransfers);
  const depthPlayers: SquadDepthPlayer[] = assessment.players.map((playerAssessment) => {
    const context = contextByPlayer.get(playerAssessment.playerId);
    const marketValue = marketValues.get(playerAssessment.playerId);
    return {
      ...playerAssessment,
      skills: context?.skills ?? {},
      playerName: context?.playerName ?? `Player ${playerAssessment.playerId}`,
      age: context?.age ?? null,
      sokkerValue: context?.sokkerValue ?? null,
      developmentPlan: context?.developmentPlan ?? null,
      trainingPath: context?.trainingPath ?? null,
      developmentTarget: context?.developmentTarget ?? null,
      projection: context?.projection ?? null,
      formation: context?.formation ?? null,
      marketValue: marketValue?.current ?? null,
      marketProjection: marketValue?.projection ?? null,
      marketTrainingComparison: marketValue?.trainingComparison ?? null,
      training: context?.training ?? null,
      trainingHistory: context?.trainingHistory ?? null
    };
  });

  return {
    ...assessment,
    manualAssignments: assignments.map(mapAssignment),
    currentGameWeek: latest.gameWeek,
    depthPlayers
  };
}

export async function getSquadDepthAnalysis(clubId: ClubId): Promise<SquadDepthAnalysis> {
  const assessment = await getSquadAssessment(clubId);
  return analyzeSquadDepth(assessment.depthPlayers, {
    currentGameWeek: assessment.currentGameWeek
  });
}

export async function getSquadPlanningRecommendations(
  clubId: ClubId
): Promise<SquadPlanningRecommendations> {
  const assessment = await getSquadAssessment(clubId);
  const depthAnalysis = analyzeSquadDepth(assessment.depthPlayers, {
    currentGameWeek: assessment.currentGameWeek
  });
  return generateSquadPlanningRecommendations({
    depthAnalysis,
    players: assessment.depthPlayers
  });
}

export async function getSquadRoleAssignment(input: {
  playerId: number;
  clubId: ClubId;
}): Promise<PersistedSquadRoleAssignment | null> {
  return playerRepository.findSquadRole({
    ...input,
    clubId: await resolveNumericClubId(input.clubId)
  });
}

export async function saveSquadRoleAssignment(
  input: Omit<SaveSquadRoleAssignmentInput, "clubId"> & { clubId: ClubId }
): Promise<PersistedSquadRoleAssignment> {
  return playerRepository.saveSquadRole({
    ...input,
    clubId: await resolveNumericClubId(input.clubId)
  });
}

export async function resetSquadRoleAssignment(input: {
  playerId: number;
  clubId: ClubId;
}): Promise<void> {
  await playerRepository.deleteSquadRole({
    ...input,
    clubId: await resolveNumericClubId(input.clubId)
  });
}

async function resolveNumericClubId(clubId: ClubId): Promise<number> {
  const numericClubId = Number(clubId);
  if (Number.isInteger(numericClubId) && numericClubId > 0) {
    return numericClubId;
  }

  const club = await clubRepository.findById(String(clubId));
  if (!club) {
    throw new Error(`Club not found: ${clubId}`);
  }

  return club.clubId;
}

function buildPlayerContext(
  player: PersistedPlayerSnapshot,
  history: TrainingHistory | null,
  developmentOverride: PersistedPlayerDevelopmentOverride | null,
  assignment: PersistedSquadRoleAssignment | null,
  currentGameWeek: number | null,
  currentDate: Date
): SquadPlayerContext {
  const developmentPlayer: DevelopmentPlayer = {
    playerId: player.playerId,
    skills: player.skills,
    age: player.age,
    formation: formationForTrainingPosition(player.training.position),
    observedPosition: player.observedPosition
  };
  const override: PlayerDevelopmentTargetOverride = {
    profile: developmentOverride?.profile,
    targetLevels: developmentOverride?.targetLevels
  };
  const plan = buildPlan(developmentPlayer, override);
  const talent = history ? estimateTalentFromTrainingHistory(history) : null;
  const latestTraining = history?.weeks.at(-1);
  const currentTrainingProgress = estimateCurrentTrainingProgress(history, talent, currentGameWeek);
  const trainingPath = generatePlayerTrainingPath({
    player: { ...developmentPlayer, age: player.age ?? 16 },
    target: plan.target,
    developmentGap: plan.gap,
    talent,
    trainingHistory: history ? [history] : undefined
  });
  const projection = buildProjection({
    player,
    developmentPlayer,
    target: plan.target,
    trainingPath,
    talent,
    latestTraining,
    currentTrainingProgress,
    currentGameWeek,
    currentDate
  });

  return {
    ...developmentPlayer,
    playerName: player.name,
    age: player.age,
    sokkerValue: player.value,
    profile: plan.target.profile,
    developmentPlan: plan,
    developmentTarget: plan.target,
    developmentGap: plan.gap,
    trainingPath,
    projection,
    hasDevelopmentPlan: developmentOverride !== null,
    talent,
    trainingHistory: history,
    training: {
      kind: player.training.advanced ? "advanced" : (latestTraining?.kind ?? "formation"),
      intensity: latestTraining?.intensity ?? null,
      skill: mapTrainingSkill(latestTraining?.skill ?? null)
    },
    historyWeeks: history?.weeks.length ?? 0,
    manualRole: assignment ? mapAssignment(assignment) : null
  };
}

function createMarketValues(
  contexts: readonly SquadPlayerContext[],
  transfers: import("@atlas/domain").PlayerTransferRecord[]
): Map<number, MarketValueEntry> {
  const values = new Map<number, MarketValueEntry>();

  for (const context of contexts) {
    const player = toMarketValuePlayer(context);
    const marketContext = {
      player,
      developmentProfile: context.profile ?? null,
      developmentPlan: context.developmentPlan ?? null,
      talent: context.talent ?? null
    };
    try {
      const current = calibratePlayerMarketValue(marketContext, transfers);
      const projection =
        context.developmentPlan && context.trainingPath && context.projection
          ? projectPlayerMarketValue({
              player,
              developmentPlan: context.developmentPlan,
              path: context.trainingPath,
              projection: context.projection,
              currentMarketValue: current,
              talent: context.talent ?? null,
              transfers
            })
          : null;
      const trainingComparison =
        context.developmentPlan && context.trainingPath
          ? createMarketTrainingComparison(context, player, current, transfers)
          : null;
      values.set(context.playerId, { current, projection, trainingComparison });
    } catch {
      // Market value is derived data. A malformed player must not break squad planning.
    }
  }

  return values;
}

interface MarketValueEntry {
  current: ReturnType<typeof calibratePlayerMarketValue>;
  projection: ReturnType<typeof projectPlayerMarketValue> | null;
  trainingComparison: ReturnType<typeof compareAdvancedAndFormationMarketValue> | null;
}

function createMarketTrainingComparison(
  context: SquadPlayerContext,
  player: PlayerMarketValuePlayerInput,
  current: ReturnType<typeof calibratePlayerMarketValue>,
  transfers: import("@atlas/domain").PlayerTransferRecord[]
): ReturnType<typeof compareAdvancedAndFormationMarketValue> | null {
  if (!context.developmentPlan || !context.trainingPath || !context.projection) return null;

  const advancedProjection = createScenarioProjection(context, "advanced");
  const formationProjection = createScenarioProjection(context, "formation");
  if (!advancedProjection || !formationProjection) return null;

  try {
    return compareAdvancedAndFormationMarketValue({
      advanced: {
        player,
        developmentPlan: context.developmentPlan,
        path: context.trainingPath,
        projection: advancedProjection,
        currentMarketValue: current,
        talent: context.talent ?? null,
        transfers
      },
      formation: {
        player,
        developmentPlan: context.developmentPlan,
        path: context.trainingPath,
        projection: formationProjection,
        currentMarketValue: current,
        talent: context.talent ?? null,
        transfers
      },
      fixedHorizonWeeks: PLAYER_MARKET_VALUE_COMPARISON_HORIZON_WEEKS
    });
  } catch {
    return null;
  }
}

function createScenarioProjection(
  context: SquadPlayerContext,
  trainingKind: "advanced" | "formation"
): ReturnType<typeof projectDevelopment> | null {
  if (
    !context.developmentPlan ||
    !context.trainingPath ||
    !context.projection ||
    context.age === null
  )
    return null;
  try {
    return projectDevelopment({
      player: {
        playerId: context.playerId,
        age: context.age,
        skills: context.skills,
        formation: context.formation ?? null,
        observedPosition: context.observedPosition ?? null
      },
      target: context.developmentPlan.target,
      path: context.trainingPath,
      currentGameWeek: context.projection.generatedAtGameWeek,
      currentDate: context.projection.generatedAtDate,
      talent: context.talent ?? null,
      trainingAssumptions: {
        trainingKind,
        expectedIntensity: context.projection.assumptions.expectedIntensity,
        assumeContinuousTraining: context.projection.assumptions.assumeContinuousTraining
      }
    });
  } catch {
    return null;
  }
}

function toMarketValuePlayer(context: SquadPlayerContext): PlayerMarketValuePlayerInput {
  return {
    playerId: context.playerId,
    age: context.age,
    skills: context.skills,
    formation: context.formation ?? null,
    position: context.position ?? null,
    observedPosition: context.observedPosition ?? null,
    profile: context.profile ?? null,
    sokkerValue: context.sokkerValue ?? null
  };
}

function estimateCurrentTrainingProgress(
  history: TrainingHistory | null,
  talent: ReturnType<typeof estimateTalentFromTrainingHistory> | null,
  currentGameWeek: number | null
): DevelopmentCurrentSkillProgress | undefined {
  if (!history || !talent?.value || currentGameWeek === null) return undefined;

  try {
    const report = buildWeeklyTrainingReport({
      players: [{ history, talent: talent.value }],
      gameWeek: currentGameWeek
    }).players[0];
    if (
      !report ||
      report.trainingPoints.estimatedProgress === null ||
      report.trainingPoints.remainingToNextLevel === null
    ) {
      return undefined;
    }

    return {
      skill: report.training.skill,
      estimatedProgress: report.trainingPoints.estimatedProgress,
      remainingToNextLevel: report.trainingPoints.remainingToNextLevel,
      confidence:
        talent.confidence === "high" ? "high" : talent.confidence === "medium" ? "medium" : "low"
    };
  } catch {
    return undefined;
  }
}
function buildProjection(input: {
  player: PersistedPlayerSnapshot;
  developmentPlayer: DevelopmentPlayer;
  target: ReturnType<PlayerDevelopmentPlanner["createPlan"]>["target"];
  trainingPath: ReturnType<typeof generatePlayerTrainingPath>;
  talent: ReturnType<typeof estimateTalentFromTrainingHistory> | null;
  latestTraining: TrainingHistory["weeks"][number] | undefined;
  currentTrainingProgress: DevelopmentCurrentSkillProgress | undefined;
  currentGameWeek: number | null;
  currentDate: Date;
}) {
  if (input.currentGameWeek === null || input.player.age === null) {
    return null;
  }

  try {
    return projectDevelopment({
      player: { ...input.developmentPlayer, age: input.player.age },
      target: input.target,
      path: input.trainingPath,
      currentGameWeek: input.currentGameWeek,
      currentDate: input.currentDate,
      talent: input.talent,
      currentTrainingProgress: input.currentTrainingProgress,
      trainingAssumptions: {
        trainingKind: input.latestTraining?.kind === "advanced" ? "advanced" : "formation",
        expectedIntensity: input.latestTraining?.intensity ?? 100,
        assumeContinuousTraining: true
      }
    });
  } catch {
    return null;
  }
}

function buildPlan(player: DevelopmentPlayer, override: PlayerDevelopmentTargetOverride) {
  return new PlayerDevelopmentPlanner().createPlan(player, override);
}

function buildTrainingHistories(
  reports: readonly PersistedPlayerTrainingWeek[]
): Map<number, TrainingHistory> {
  const byPlayer = new Map<number, PersistedPlayerTrainingWeek[]>();
  for (const report of reports) {
    byPlayer.set(report.playerId, [...(byPlayer.get(report.playerId) ?? []), report]);
  }
  return new Map(
    [...byPlayer.entries()].map(([playerId, playerReports]) => [
      playerId,
      {
        playerId,
        weeks: playerReports
          .sort((left, right) => left.gameWeek - right.gameWeek)
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
          )
      }
    ])
  );
}

function toDomainSkills(skills: PersistedPlayerTrainingWeek["skills"]): PlayerSkills {
  return {
    stamina: skills.stamina,
    pace: skills.pace,
    technique: skills.technique,
    passing: skills.passing,
    keeper: skills.keeper,
    playmaking: skills.playmaking,
    defending: skills.defending,
    striker: skills.striker
  };
}

function toDomainSkillsChange(
  change: PersistedPlayerTrainingWeek["skillsChange"]
): PlayerSkillsChange {
  return {
    stamina: change.stamina,
    pace: change.pace,
    technique: change.technique,
    passing: change.passing,
    keeper: change.keeper,
    playmaking: change.playmaking,
    defending: change.defending,
    striker: change.striker,
    up: change.up,
    down: change.down
  };
}

function formationForTrainingPosition(position: number): "GK" | "DEF" | "MID" | "ATT" {
  if (position === 0) return "GK";
  if (position === 1) return "DEF";
  if (position === 3) return "ATT";
  return "MID";
}

function mapTrainingSkill(
  skill: PersistedPlayerTrainingWeek["type"] | "scoring" | null
):
  | "stamina"
  | "pace"
  | "technique"
  | "passing"
  | "keeper"
  | "defender"
  | "playmaker"
  | "striker"
  | null {
  if (skill === null) return null;
  if (skill === "defending") return "defender";
  if (skill === "playmaking") return "playmaker";
  if (skill === "striker" || skill === "scoring") return "striker";
  if (skill === "general") return null;
  return skill;
}

function mapAssignment(assignment: PersistedSquadRoleAssignment): SquadRoleAssignment {
  return {
    playerId: assignment.playerId,
    role: assignment.role,
    source: "manual"
  };
}
function mapMarketTransferToRecord(
  transfer: import("@atlas/database").PersistedMarketTransfer,
  currencyName: string,
  currencyRate: number
): import("@atlas/domain").PlayerTransferRecord {
  return {
    transferId: transfer.transferKey,
    playerId: transfer.playerId,
    transferDate: transfer.transferDate,
    gameWeek: transfer.gameWeek,
    salePrice: Math.round(transfer.salePrice / currencyRate),
    currency: currencyName,
    age: transfer.age,
    skills: {
      stamina: transfer.skills.stamina ?? null,
      pace: transfer.skills.pace ?? null,
      technique: transfer.skills.technique ?? null,
      passing: transfer.skills.passing ?? null,
      keeper: transfer.skills.keeper ?? null,
      defender: transfer.skills.defending ?? transfer.skills.defender ?? null,
      playmaker: transfer.skills.playmaking ?? transfer.skills.playmaker ?? null,
      striker: transfer.skills.striker ?? null
    },
    source: "imported",
    salePriceType: "final_sale"
  };
}
