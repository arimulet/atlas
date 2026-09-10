import type { Confidence } from "../types.js";
import type { DevelopmentProfile } from "../playerDevelopment/index.js";
import type {
  ProfileDepthAssessment,
  SquadDepthAnalysis,
  SquadDepthAnalysisConfig,
  SquadDepthPlayer,
  SquadPlanningHorizon
} from "./depth-types.js";
import type { PlayerLifecycleStage, SquadRole } from "./types.js";

export type SquadPlanningRecommendationType =
  | "maintain"
  | "develop_internal"
  | "accelerate_development"
  | "reprofile_player"
  | "find_external"
  | "reduce_depth"
  | "prepare_successor"
  | "monitor";

export type SquadPlanningRecommendationPriority = "critical" | "high" | "medium" | "low";

export type SquadPlanningReason =
  | { type: "current_depth_below_minimum"; current: number; minimum: number }
  | { type: "future_depth_below_minimum"; horizon: SquadPlanningHorizon }
  | { type: "missing_successor" }
  | { type: "successor_not_ready_in_time"; playerId: number }
  | { type: "internal_candidate_available"; playerId: number }
  | { type: "no_internal_candidate" }
  | { type: "profile_overstocked"; count: number; maximum: number }
  | { type: "development_congestion" }
  | { type: "single_player_dependency"; playerId: number }
  | {
      type: "compatible_reprofile_candidate";
      playerId: number;
      targetProfile: DevelopmentProfile;
    }
  | { type: "borderline_succession" }
  | { type: "low_confidence_projection" }
  | { type: "healthy_profile" };

export interface SquadPlanningCandidate {
  playerId: number;
  suitabilityScore: number | null;
  currentRole: SquadRole;
  lifecycle: PlayerLifecycleStage;
  currentContribution: number | null;
  futureContribution: number | null;
  developmentProfile: DevelopmentProfile | null;
  confidence: Confidence;
}

export interface SquadNeed {
  profile: DevelopmentProfile;
  horizon: SquadPlanningHorizon;
  priority: SquadPlanningRecommendationPriority;
}

export interface SquadPlanningRecommendation {
  id: string;
  type: SquadPlanningRecommendationType;
  profile: DevelopmentProfile;
  priority: SquadPlanningRecommendationPriority;
  horizon: SquadPlanningHorizon;
  playerIds: number[];
  targetPlayerId?: number;
  confidence: Confidence;
  reasons: SquadPlanningReason[];
  candidates?: SquadPlanningCandidate[];
  need?: SquadNeed;
}

export type SquadPlanningConflictType =
  "multiple_profile_demand" | "development_vs_depth_reduction";

export interface SquadPlanningConflict {
  playerId: number;
  recommendationIds: string[];
  type: SquadPlanningConflictType;
}

export interface SquadPlanningRecommendationsSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  profilesNeedingExternalHelp: number;
  profilesWithInternalSolutions: number;
  profilesOverstocked: number;
}

export interface SquadPlanningRecommendations {
  recommendations: SquadPlanningRecommendation[];
  conflicts: SquadPlanningConflict[];
  summary: SquadPlanningRecommendationsSummary;
}

export interface SquadPlanningRecommendationConfig {
  internalCandidateThreshold: number;
  reprofileSuitabilityThreshold: number;
  reprofileAdvantageMargin: number;
  dependencyHighGap: number;
  stabilityMargin: number;
  accelerateWindowWeeks: number;
  mediumTermWeeks: number;
  emitMaintainRecommendations: boolean;
}

export interface SquadPlanningRecommendationsInput {
  depthAnalysis: SquadDepthAnalysis;
  players: readonly SquadDepthPlayer[];
  previous?: SquadPlanningRecommendations | null;
  config?: Partial<SquadPlanningRecommendationConfig>;
}

export interface SquadPlanningProfileContext {
  assessment: ProfileDepthAssessment;
  players: readonly SquadDepthPlayer[];
}

export type { SquadDepthAnalysisConfig };
