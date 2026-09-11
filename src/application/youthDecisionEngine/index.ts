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

const YOUTH_DECISION_CACHE_TTL_MS = 60_000;
const youthDecisionCache = new Map<string, { data: YouthDecisionPlanning; timestamp: number }>();
const inFlightYouthDecisions = new Map<string, Promise<YouthDecisionPlanning>>();

export function invalidateYouthDecisionPlanningCache(clubId?: ClubId): void {
  if (clubId) {
    youthDecisionCache.delete(String(clubId));
  } else {
    youthDecisionCache.clear();
  }
}

export async function getYouthDecisionPlanning(clubId: ClubId): Promise<YouthDecisionPlanning> {
  const cacheKey = String(clubId);
  const cached = youthDecisionCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < YOUTH_DECISION_CACHE_TTL_MS) {
    return cached.data;
  }

  const inFlight = inFlightYouthDecisions.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const computePromise = computeYouthDecisionPlanning(clubId).then(
    (data) => {
      youthDecisionCache.set(cacheKey, { data, timestamp: Date.now() });
      inFlightYouthDecisions.delete(cacheKey);
      return data;
    },
    (err) => {
      inFlightYouthDecisions.delete(cacheKey);
      throw err;
    }
  );

  inFlightYouthDecisions.set(cacheKey, computePromise);
  return computePromise;
}

async function computeYouthDecisionPlanning(clubId: ClubId): Promise<YouthDecisionPlanning> {
  const club = await clubRepository.findById(clubId.toString());
  if (!club) throw new Error(`Club not found: ${clubId}`);

  const [squadAssessment, latestSnapshot, juniors, persistedPlayers, trainingWeeks] = await Promise.all([
    getSquadAssessment(clubId),
    snapshotRepository.findLatestByClub(club.clubId),
    juniorRepository.listByClub(club.clubId),
    playerRepository.listByClub(club.clubId),
    trainingWeekRepository.listByClub(club.clubId)
  ]);

  const advancedTraining = await Promise.resolve()
    .then(() =>
      buildAdvancedTrainingOptimizationFromLoadedData(
        trainingWeeks,
        latestSnapshot ? [latestSnapshot] : [],
        juniors,
        persistedPlayers
      )
    )
    .catch(() => null);

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
  const devProj = entry.player.projection;
  const lightDevProjection = devProj
    ? {
        ...devProj,
        steps: devProj.steps.slice(0, 1),
        milestones: []
      }
    : null;

  const marketProj = entry.player.marketProjection;
  const lightMarketProjection = marketProj
    ? {
        ...marketProj,
        points: []
      }
    : null;

  return {
    playerId: entry.player.playerId,
    playerName: entry.player.playerName ?? `Player ${entry.player.playerId}`,
    countryName: entry.player.countryName ?? null,
    age: entry.player.age ?? null,
    role: entry.player.role,
    formation: entry.player.formation ?? null,
    initialProfile: entry.context.prospect.suggestedProfile,
    prospect: entry.context.prospect,
    opportunity: entry.context.opportunity,
    recommendation,
    developmentPlan: null,
    trainingPath: null,
    developmentProjection: lightDevProjection,
    marketValue: entry.player.marketValue ?? null,
    marketProjection: lightMarketProjection,
    currentlyAdvanced: entry.player.training?.kind === "advanced",
    advancedTrainingRecommendation:
      advancedRecsByPlayerId?.get(entry.player.playerId) ??
      entry.context.advancedTraining?.recommendations.find(
        (candidate) => candidate.playerId === entry.player.playerId
      ) ??
      null
  };
}
