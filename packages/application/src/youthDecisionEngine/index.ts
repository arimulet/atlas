import {
  analyzeSquadDepth,
  assessYouthDevelopmentOpportunity,
  assessYouthProspect,
  evaluateYouthDecisions,
  generateSquadPlanningRecommendations,
  summarizeYouthDecisions,
  type AdvancedTrainingOptimization,
  type AdvancedTrainingPlayerRecommendation,
  type DevelopmentPlayer,
  type SquadDepthPlayer,
  type YouthDecisionContext
} from "@atlas/domain";
import {
  MongoClubRepository,
  MongoJuniorRepository,
  MongoPlayerRepository,
  MongoSnapshotRepository,
  MongoTrainingWeekRepository
} from "@atlas/database";
import { getSquadAssessment, buildTrainingHistories } from "../squadPlanning/index.js";
import { buildAdvancedTrainingOptimizationFromLoadedData } from "../training/index.js";
import type { ClubId } from "../types.js";
import { YOUTH_PIPELINE_AGE_THRESHOLD } from "../playerDevelopment/index.js";
import type { YouthDecisionCandidate, YouthDecisionPlanning } from "./types.js";

const clubRepository = new MongoClubRepository();
const snapshotRepository = new MongoSnapshotRepository();
const trainingWeekRepository = new MongoTrainingWeekRepository();
const juniorRepository = new MongoJuniorRepository();
const playerRepository = new MongoPlayerRepository();

export {
  assessYouthProspect,
  assessYouthProspects,
  assessYouthDevelopmentOpportunity,
  assessYouthStrategicAssessment,
  buildYouthProspectDiagnostic,
  evaluateYouthDecisions,
  evaluateYouthDevelopmentOpportunities,
  recommendYouthDecision,
  summarizeYouthDecisions,
  YouthDecisionRecommendationService,
  YouthDecisionEngine
} from "@atlas/domain";
export type {
  YouthProspectAssessment,
  YouthProspectContext,
  YouthProspectDiagnostic,
  YouthProspectPlayer,
  YouthProspectReason,
  YouthProspectStrength,
  YouthProspectWeakness,
  YouthAdvancedTrainingOpportunity,
  YouthDevelopmentOpportunity,
  YouthFitConfig,
  YouthFitContext,
  YouthFitPlayer,
  YouthFitReason,
  YouthProfileDevelopmentCapacity,
  YouthReprofileOpportunity,
  YouthStrategicAssessment,
  YouthSuccessionFit,
  YouthDecision,
  YouthDecisionConfig,
  YouthDecisionContext,
  YouthDecisionPriority,
  YouthDecisionReason,
  YouthDecisionRecommendation,
  YouthDecisionRisk,
  YouthDecisionScoreBreakdown,
  YouthDecisionScores,
  YouthDecisionSummary
} from "@atlas/domain";
export type { YouthDecisionCandidate, YouthDecisionPlanning } from "./types.js";

export async function getYouthDecisionPlanning(clubId: ClubId): Promise<YouthDecisionPlanning> {
  const club = await clubRepository.findById(clubId.toString());
  if (!club) throw new Error(`Club not found: ${clubId}`);

  const [snapshots, trainingWeeks, juniors, persistedPlayers] = await Promise.all([
    snapshotRepository.listByClub(club.clubId),
    trainingWeekRepository.listByClub(club.clubId),
    juniorRepository.listByClub(club.clubId),
    playerRepository.listByClub(club.clubId)
  ]);

  const [squadAssessment, advancedTraining] = await Promise.all([
    getSquadAssessment(clubId, { club, snapshots, trainingWeeks }),
    Promise.resolve()
      .then(() =>
        buildAdvancedTrainingOptimizationFromLoadedData(
          trainingWeeks,
          snapshots,
          juniors,
          persistedPlayers
        )
      )
      .catch(() => null)
  ]);
  const trainingHistories = buildTrainingHistories(trainingWeeks);
  const depthAnalysis = analyzeSquadDepth(squadAssessment.depthPlayers, {
    currentGameWeek: squadAssessment.currentGameWeek
  });
  const squadRecommendations = generateSquadPlanningRecommendations({
    depthAnalysis,
    players: squadAssessment.depthPlayers
  });
  const contextEntries = squadAssessment.depthPlayers
    .filter(
      (player) => typeof player.age === "number" && player.age <= YOUTH_PIPELINE_AGE_THRESHOLD
    )
    .map((player) =>
      createYouthDecisionContext(
        player,
        trainingHistories,
        squadAssessment,
        depthAnalysis,
        squadRecommendations,
        advancedTraining
      )
    );
  const contextEntriesByPlayerId = new Map(
    contextEntries.map((entry) => [entry.context.player.playerId, entry])
  );
  const advancedTrainingRecommendationsByPlayerId = new Map(
    (advancedTraining?.recommendations ?? []).map((r) => [r.playerId, r])
  );

  const recommendations = evaluateYouthDecisions(contextEntries.map(({ context }) => context));
  const candidates = recommendations.flatMap((recommendation) => {
    const entry = contextEntriesByPlayerId.get(recommendation.playerId);
    return entry
      ? [toCandidate(entry, recommendation, advancedTrainingRecommendationsByPlayerId)]
      : [];
  });

  return {
    clubId: String(clubId),
    candidates,
    summary: summarizeYouthDecisions(recommendations),
    advancedTraining
  };
}

function createYouthDecisionContext(
  player: SquadDepthPlayer,
  trainingHistories: Map<number, import("@atlas/domain").TrainingHistory>,
  squadAssessment: Awaited<ReturnType<typeof getSquadAssessment>>,
  depthAnalysis: ReturnType<typeof analyzeSquadDepth>,
  squadRecommendations: ReturnType<typeof generateSquadPlanningRecommendations>,
  advancedTraining: AdvancedTrainingOptimization | null
): { context: YouthDecisionContext; player: SquadDepthPlayer } {
  const developmentPlayer: DevelopmentPlayer = {
    playerId: player.playerId,
    skills: player.skills ?? {},
    age: player.age,
    formation: player.formation ?? null,
    observedPosition: null
  };
  const youthPlayer = { ...developmentPlayer, name: player.playerName };
  const history = trainingHistories.get(player.playerId) ?? player.trainingHistory ?? null;
  const prospect = assessYouthProspect({
    player: developmentPlayer,
    trainingHistory: history ? [history] : undefined
  });

  return {
    player,
    context: {
      player: youthPlayer,
      prospect,
      opportunity: assessYouthDevelopmentOpportunity({
        player: youthPlayer,
        prospectAssessment: prospect,
        squadAssessment,
        depthAnalysis,
        squadRecommendations,
        developmentPlan: player.developmentPlan,
        developmentProjection: player.projection,
        trainingPath: player.trainingPath,
        advancedTraining,
        currentGameWeek: squadAssessment.currentGameWeek
      }),
      developmentPlan: player.developmentPlan,
      developmentProjection: player.projection,
      trainingPath: player.trainingPath,
      marketValue: player.marketValue,
      marketProjection: player.marketProjection,
      advancedTraining
    }
  };
}

function toCandidate(
  entry: ReturnType<typeof createYouthDecisionContext>,
  recommendation: YouthDecisionCandidate["recommendation"],
  advancedRecsByPlayerId?: Map<number, AdvancedTrainingPlayerRecommendation>
): YouthDecisionCandidate {
  return {
    playerId: entry.player.playerId,
    playerName: entry.player.playerName ?? `Player ${entry.player.playerId}`,
    age: entry.player.age ?? null,
    role: entry.player.role,
    formation: entry.player.formation ?? null,
    initialProfile: entry.context.prospect.suggestedProfile,
    prospect: entry.context.prospect,
    opportunity: entry.context.opportunity,
    recommendation,
    developmentPlan: entry.player.developmentPlan ?? null,
    trainingPath: entry.player.trainingPath ?? null,
    developmentProjection: entry.player.projection ?? null,
    marketValue: entry.player.marketValue ?? null,
    marketProjection: entry.player.marketProjection ?? null,
    currentlyAdvanced: entry.player.training?.kind === "advanced",
    advancedTrainingRecommendation:
      advancedRecsByPlayerId?.get(entry.player.playerId) ??
      entry.context.advancedTraining?.recommendations.find(
        (candidate) => candidate.playerId === entry.player.playerId
      ) ??
      null
  };
}
