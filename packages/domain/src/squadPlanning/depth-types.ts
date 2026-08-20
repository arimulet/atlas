import type { Confidence } from "../types.js";
import type { Formation } from "../playerDevelopment/index.js";
import type {
  DevelopmentProfile,
  PlayerDevelopmentPlan,
  PlayerDevelopmentProjection,
  PlayerDevelopmentTarget
} from "../playerDevelopment/index.js";
import type { SquadPlayerAssessment } from "./types.js";

export type SquadPlanningHorizon = "current" | "next_season" | "medium_term";

export type ProfileDepthStatus = "critical" | "thin" | "balanced" | "deep" | "overstocked";

export type SuccessionReadiness = "ready" | "developing" | "long_term";

export type SuccessionCoverageStatus = "covered" | "at_risk" | "missing";

export interface SquadProfileRequirement {
  profile: DevelopmentProfile;
  minimum: number;
  ideal: number;
  maximum?: number;
}

export interface ProfileDepthSnapshot {
  availablePlayers: number;
  strongOptions: number;
  developingOptions: number;
  prospects: number;
  playerIds: number[];
  depthScore: number | null;
}

export interface ProfileDependencyRisk {
  dominantPlayerId: number;
  contributionGap: number;
}

export interface SuccessionCandidate {
  playerId: number;
  predecessorPlayerId?: number;
  readiness: SuccessionReadiness;
  estimatedReadyGameWeek?: number | null;
  currentContributionScore: number | null;
  futureContributionScore: number | null;
  confidence: Confidence;
}

export interface ProfileSuccessionAssessment {
  successionRequired: boolean;
  outgoingPlayers: number[];
  successorCandidates: SuccessionCandidate[];
  coverageStatus: SuccessionCoverageStatus;
}

export type SquadDepthReason =
  | { type: "below_minimum_depth"; current: number; minimum: number }
  | { type: "healthy_depth" }
  | { type: "single_player_dependency"; playerId: number }
  | { type: "missing_successor"; playerId?: number }
  | { type: "succession_covered"; successorPlayerId: number }
  | { type: "late_lifecycle_concentration" }
  | { type: "development_congestion"; candidates: number }
  | { type: "prospect_pipeline_missing" }
  | { type: "overstocked_profile" }
  | { type: "future_depth_below_minimum"; horizon: SquadPlanningHorizon }
  | { type: "future_depth_healthy"; horizon: SquadPlanningHorizon }
  | { type: "orphan_prospect"; playerId: number };

export interface ProfileDepthAssessment {
  profile: DevelopmentProfile;
  requirement: SquadProfileRequirement;
  current: ProfileDepthSnapshot;
  nextSeason: ProfileDepthSnapshot;
  mediumTerm: ProfileDepthSnapshot;
  succession: ProfileSuccessionAssessment;
  status: ProfileDepthStatus;
  confidence: Confidence;
  dependencyRisk: ProfileDependencyRisk | null;
  reasons: SquadDepthReason[];
}

export interface SquadDepthAnalysisSummary {
  criticalProfiles: number;
  thinProfiles: number;
  balancedProfiles: number;
  deepProfiles: number;
  overstockedProfiles: number;
  missingSuccessions: number;
  dependencyRisks: number;
}

export interface SquadDepthAnalysis {
  profiles: ProfileDepthAssessment[];
  summary: SquadDepthAnalysisSummary;
}

export interface SquadDepthPlayer extends SquadPlayerAssessment {
  age?: number | null;
  developmentPlan?: PlayerDevelopmentPlan | null;
  developmentTarget?: PlayerDevelopmentTarget | null;
  projection?: PlayerDevelopmentProjection | null;
  compatibleProfiles?: readonly DevelopmentProfile[];
  profileContributions?: Partial<Record<DevelopmentProfile, number>>;
  fallbackProfile?: DevelopmentProfile | null;
  formation?: Formation | null;
}

export interface SquadDepthAnalysisConfig {
  requirements: readonly SquadProfileRequirement[];
  strongOptionThreshold: number;
  developingOptionThreshold: number;
  futureOptionThreshold: number;
  singlePlayerDependencyGap: number;
  secondaryProfileWeight: number;
  nextSeasonWeeks: number;
  mediumTermWeeks: number;
  futurePipelineCapacityBuffer: number;
  lateLifecycleConcentrationMinimum: number;
}

export interface SquadDepthAnalysisOptions {
  requirements?: readonly SquadProfileRequirement[];
  currentGameWeek?: number | null;
  config?: Partial<SquadDepthAnalysisConfig>;
}

export interface SquadDepthAnalysisInput extends SquadDepthAnalysisOptions {
  players: readonly (SquadDepthPlayer | SquadPlayerAssessment)[];
}
