import type { Confidence } from "../types.js";
import type {
  DevelopmentProfile,
  PlayerDevelopmentPlan,
  PlayerDevelopmentProjection,
  PlayerTrainingPath
} from "../playerDevelopment/index.js";
import type { AdvancedTrainingOptimization } from "../training/types.js";
import type {
  CalibratedPlayerMarketValueEstimate,
  PlayerMarketValueEstimate,
  PlayerMarketValueProjection
} from "../playerMarketValue/index.js";
import type { YouthDevelopmentOpportunity, YouthFitPlayer } from "./fit-types.js";
import type { YouthProspectAssessment } from "./types.js";

export type YouthDecision = "train" | "keep" | "sell" | "release" | "hold" | "unknown";
export type YouthDecisionPriority = "high" | "medium" | "low";

export type YouthDecisionReason =
  | { type: "elite_prospect" }
  | { type: "strong_club_fit" }
  | { type: "fills_future_squad_need"; profile: DevelopmentProfile }
  | { type: "succession_candidate" }
  | { type: "high_development_upside" }
  | { type: "high_development_value_creation" }
  | { type: "high_training_value_efficiency" }
  | { type: "advanced_training_candidate" }
  | { type: "formation_development_viable" }
  | { type: "profile_overstocked" }
  | { type: "limited_internal_opportunity" }
  | { type: "strong_market_value" }
  | { type: "high_resource_competition" }
  | { type: "better_alternative_profile"; profile: DevelopmentProfile }
  | { type: "low_development_upside" }
  | { type: "low_economic_value" }
  | { type: "insufficient_evidence" }
  | { type: "insufficient_training_snapshots" };

export type YouthDecisionRisk =
  | { type: "talent_uncertain" }
  | { type: "market_value_uncertain" }
  | { type: "advanced_slot_unlikely" }
  | { type: "profile_congestion" }
  | { type: "long_development_horizon" }
  | { type: "successor_timing_risk" }
  | { type: "low_market_evidence" };

export interface YouthDecisionScores {
  prospectQuality: number | null;
  clubFit: number | null;
  developmentOpportunity: number | null;
  economicOpportunity: number | null;
  resourceEfficiency: number | null;
}

export interface YouthDecisionScoreBreakdown extends YouthDecisionScores {
  positiveSignals: number;
  negativeSignals: number;
}

export interface YouthDecisionContext {
  player: YouthFitPlayer;
  prospect: YouthProspectAssessment;
  opportunity: YouthDevelopmentOpportunity;
  developmentPlan?: PlayerDevelopmentPlan | null;
  trainingPath?: PlayerTrainingPath | null;
  developmentProjection?: PlayerDevelopmentProjection | null;
  marketValue?: CalibratedPlayerMarketValueEstimate | PlayerMarketValueEstimate | null;
  marketProjection?: PlayerMarketValueProjection | null;
  advancedTraining?: AdvancedTrainingOptimization | null;
  previousDecision?: YouthDecisionRecommendation | null;
}

export interface YouthDecisionRecommendation {
  playerId: number;
  decision: YouthDecision;
  priority: YouthDecisionPriority;
  sportingConfidence: Confidence;
  economicConfidence: Confidence;
  scores: YouthDecisionScores;
  recommendedProfile: DevelopmentProfile | null;
  alternativeProfile: DevelopmentProfile | null;
  reasons: YouthDecisionReason[];
  risks: YouthDecisionRisk[];
  breakdown: YouthDecisionScoreBreakdown;
}

export interface YouthDecisionConfig {
  marketValueReference: number;
  highProspectThreshold: number;
  eliteProspectThreshold: number;
  lowProspectThreshold: number;
  strongClubFitThreshold: number;
  poorClubFitThreshold: number;
  goodDevelopmentOpportunityThreshold: number;
  limitedDevelopmentOpportunityThreshold: number;
  strongEconomicOpportunityThreshold: number;
  lowEconomicOpportunityThreshold: number;
  strongResourceEfficiencyThreshold: number;
  highPriorityThreshold: number;
  mediumPriorityThreshold: number;
  maximumTrainingWeeksForEfficiency: number;
  releaseRequiresMarketConfidence: Confidence;
  decisionStabilityMargin: number;
}

export const YOUTH_DECISION_CONFIG: Readonly<YouthDecisionConfig> = {
  marketValueReference: 1_000_000,
  highProspectThreshold: 0.68,
  eliteProspectThreshold: 0.8,
  lowProspectThreshold: 0.35,
  strongClubFitThreshold: 0.68,
  poorClubFitThreshold: 0.32,
  goodDevelopmentOpportunityThreshold: 0.58,
  limitedDevelopmentOpportunityThreshold: 0.35,
  strongEconomicOpportunityThreshold: 0.6,
  lowEconomicOpportunityThreshold: 0.3,
  strongResourceEfficiencyThreshold: 0.52,
  highPriorityThreshold: 0.78,
  mediumPriorityThreshold: 0.52,
  maximumTrainingWeeksForEfficiency: 52,
  releaseRequiresMarketConfidence: "high",
  decisionStabilityMargin: 0.08
};

export interface YouthDecisionSummary {
  recommendations: YouthDecisionRecommendation[];
  counts: Record<YouthDecision, number>;
  highPriorityDecisions: number;
  advancedCandidates: number;
}
