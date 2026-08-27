import {
  analyzeSquadDepth,
  assessYouthDevelopmentOpportunity,
  assessYouthProspect,
  evaluateYouthDecisions,
  generateSquadPlanningRecommendations,
  summarizeYouthDecisions,
  type DevelopmentPlayer,
  type SquadDepthPlayer,
  type YouthDecisionContext
} from "@atlas/domain";
import { getSquadAssessment } from "../squadPlanning/index.js";
import { getAdvancedTrainingOptimization } from "../training/index.js";
import type { ClubId } from "../types.js";
import { YOUTH_PIPELINE_AGE_THRESHOLD } from "../playerDevelopment/index.js";
import type { YouthDecisionCandidate, YouthDecisionPlanning } from "./types.js";

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
  const [squadAssessment, advancedTraining] = await Promise.all([
    getSquadAssessment(clubId),
    getAdvancedTrainingOptimization(clubId).catch(() => null)
  ]);
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
        squadAssessment,
        depthAnalysis,
        squadRecommendations,
        advancedTraining
      )
    );
  const recommendations = evaluateYouthDecisions(contextEntries.map(({ context }) => context));
  const candidates = recommendations.flatMap((recommendation) => {
    const entry = contextEntries.find(
      ({ context }) => context.player.playerId === recommendation.playerId
    );
    return entry ? [toCandidate(entry, recommendation)] : [];
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
  squadAssessment: Awaited<ReturnType<typeof getSquadAssessment>>,
  depthAnalysis: ReturnType<typeof analyzeSquadDepth>,
  squadRecommendations: ReturnType<typeof generateSquadPlanningRecommendations>,
  advancedTraining: Awaited<ReturnType<typeof getAdvancedTrainingOptimization>> | null
): { context: YouthDecisionContext; player: SquadDepthPlayer } {
  const developmentPlayer: DevelopmentPlayer = {
    playerId: player.playerId,
    skills: player.skills ?? {},
    age: player.age,
    formation: player.formation ?? null,
    observedPosition: null
  };
  const youthPlayer = { ...developmentPlayer, name: player.playerName };
  const prospect = assessYouthProspect({
    player: developmentPlayer,
    trainingHistory: player.trainingHistory ? [player.trainingHistory] : undefined
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
  recommendation: YouthDecisionCandidate["recommendation"]
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
    marketProjection: entry.player.marketProjection ?? null
  };
}
