import type { Confidence } from "../types.js";
import type { AdvancedTrainingOptimization } from "../training/types.js";
import type {
  DevelopmentPlayer,
  DevelopmentProfile,
  PlayerDevelopmentPlan,
  PlayerDevelopmentProjection,
  PlayerTrainingPath,
  DevelopmentProfileEvaluation
} from "../playerDevelopment/index.js";
import type {
  SquadDepthAnalysis,
  SquadPlanningHorizon,
  SquadAssessment,
  SquadPlanningRecommendations
} from "../squadPlanning/index.js";
import type { YouthProspectAssessment, YouthProspectContext } from "./types.js";

export interface YouthFitPlayer extends DevelopmentPlayer {
  name?: string;
}

export interface YouthFitContext {
  player: YouthFitPlayer;
  prospectAssessment: YouthProspectAssessment;
  squadAssessment?: SquadAssessment | null;
  depthAnalysis?: SquadDepthAnalysis | null;
  squadRecommendations?: SquadPlanningRecommendations | null;
  developmentPlan?: PlayerDevelopmentPlan | null;
  developmentProjection?: PlayerDevelopmentProjection | null;
  trainingPath?: PlayerTrainingPath | null;
  advancedTraining?: AdvancedTrainingOptimization | null;
  currentGameWeek?: number | null;
  requiredReadyGameWeek?: number | null;
  projectedFutureContributionScore?: number | null;
}

export interface YouthAdvancedTrainingOpportunity {
  projectedRank: number | null;
  currentCutoffScore: number | null;
  candidateScore: number | null;
  opportunity: "likely" | "competitive" | "unlikely" | "unknown";
}

export interface YouthSuccessionFit {
  outgoingPlayerIds: number[];
  projectedReadyGameWeek: number | null;
  requiredReadyGameWeek: number | null;
  timingGapWeeks: number | null;
  score: number | null;
}

export interface YouthReprofileOpportunity {
  currentProfile: DevelopmentProfile;
  alternativeProfile: DevelopmentProfile;
  compatibilityScore: number;
  squadNeedImprovement: number;
  viable: boolean;
}

export interface YouthProfileDevelopmentCapacity {
  profile: DevelopmentProfile;
  projectedFutureSlots: number;
  currentDevelopingPlayers: number;
  prospects: number;
  youthCandidateIncluded: boolean;
  congestionAfterInclusion: number;
}

export type YouthFitReason =
  | { type: "profile_needed"; profile: DevelopmentProfile; horizon: SquadPlanningHorizon }
  | { type: "succession_opportunity"; profile: DevelopmentProfile }
  | { type: "projected_ready_in_time" }
  | { type: "projected_ready_too_late" }
  | { type: "current_gap_not_solved_immediately" }
  | { type: "profile_overstocked" }
  | { type: "development_congestion" }
  | { type: "advanced_training_likely" }
  | { type: "advanced_training_unlikely" }
  | { type: "formation_training_viable" }
  | { type: "strong_internal_competition" }
  | { type: "reprofile_opportunity"; profile: DevelopmentProfile }
  | { type: "missing_squad_context" }
  | { type: "missing_development_projection" }
  | { type: "incomplete_development_path" };

export interface YouthDevelopmentOpportunity {
  playerId: number;
  profile: DevelopmentProfile | null;
  squadNeedScore: number | null;
  successionFitScore: number | null;
  developmentOpportunityScore: number | null;
  resourceCompetitionScore: number | null;
  clubFitScore: number | null;
  opportunity: "excellent" | "good" | "limited" | "poor" | "unknown";
  confidence: Confidence;
  reasons: YouthFitReason[];
  succession: YouthSuccessionFit | null;
  advancedTraining: YouthAdvancedTrainingOpportunity | null;
  reprofileOpportunity: YouthReprofileOpportunity | null;
  developmentCapacity: YouthProfileDevelopmentCapacity | null;
}

export interface YouthStrategicAssessment {
  prospect: YouthProspectAssessment;
  opportunity: YouthDevelopmentOpportunity;
}

export interface YouthFitConfig {
  currentHorizonWeight: number;
  nextSeasonHorizonWeight: number;
  mediumTermHorizonWeight: number;
  squadNeedWeight: number;
  successionFitWeight: number;
  developmentOpportunityWeight: number;
  resourceCompetitionWeight: number;
  advancedCompetitiveRankBuffer: number;
  successionReadyWindowWeeks: number;
  successionLateWindowWeeks: number;
  reprofileCompatibilityThreshold: number;
  reprofileNeedImprovementThreshold: number;
  excellentClubFitThreshold: number;
  goodClubFitThreshold: number;
  limitedClubFitThreshold: number;
  confidencePenaltyForUnknownProjection: boolean;
}

export const YOUTH_FIT_CONFIG: Readonly<YouthFitConfig> = {
  currentHorizonWeight: 0.15,
  nextSeasonHorizonWeight: 0.35,
  mediumTermHorizonWeight: 0.5,
  squadNeedWeight: 0.3,
  successionFitWeight: 0.25,
  developmentOpportunityWeight: 0.3,
  resourceCompetitionWeight: 0.15,
  advancedCompetitiveRankBuffer: 3,
  successionReadyWindowWeeks: 8,
  successionLateWindowWeeks: 26,
  reprofileCompatibilityThreshold: 0.75,
  reprofileNeedImprovementThreshold: 0.05,
  excellentClubFitThreshold: 0.78,
  goodClubFitThreshold: 0.58,
  limitedClubFitThreshold: 0.35,
  confidencePenaltyForUnknownProjection: true
};

export interface YouthFitAnalysisInput {
  context: YouthFitContext;
  config?: Partial<YouthFitConfig>;
}

export type YouthFitProfileEvaluation = DevelopmentProfileEvaluation;

export type YouthFitProspectInput = YouthProspectContext;
