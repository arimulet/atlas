import type { Confidence } from "../types.js";
import type { DevelopmentProfile } from "../playerDevelopment/index.js";
import type {
  ProfileDepthStatus,
  SquadDepthPlayer,
  SquadPlanningHorizon,
  SquadPlanningRecommendationPriority,
  SuccessionCoverageStatus
} from "../squadPlanning/index.js";
import type {
  CapitalAllocationContext,
  CapitalAllocationPlan,
  CapitalTiming
} from "./capital-types.js";
import type { FinancialPositionStatus } from "./types.js";

export type FinancialStrategyRecommendationType =
  | "preserve_cash"
  | "invest_in_squad"
  | "fund_priority_need"
  | "delay_recruitment"
  | "build_liquidity"
  | "monetize_surplus_asset"
  | "develop_before_monetizing"
  | "protect_strategic_asset"
  | "maintain_position"
  | "monitor";

export interface FinancialRecommendationImpact {
  estimatedCashCommitment?: number | null;
  estimatedCashRelease?: number | null;
  postActionCash?: number | null;
  postActionFinancialStatus?: FinancialPositionStatus | null;
  opportunityCost?: number | null;
}

export type FinancialStrategyReason =
  | { type: "financial_position_strained" }
  | { type: "ample_investment_capacity" }
  | { type: "priority_squad_need"; profile: DevelopmentProfile }
  | { type: "need_fully_fundable" }
  | { type: "need_not_safely_fundable" }
  | { type: "profile_overstocked"; profile: DevelopmentProfile }
  | { type: "asset_has_high_market_value"; playerId: number }
  | { type: "asset_has_low_strategic_importance"; playerId: number }
  | { type: "no_ready_successor"; playerId: number }
  | { type: "strong_short_term_value_growth"; playerId: number }
  | { type: "advanced_resource_conflict"; playerId: number }
  | { type: "funding_gap"; amount: number };

export type FinancialStrategyRisk =
  | { type: "market_value_uncertain" }
  | { type: "liquidity_reduction" }
  | { type: "squad_depth_damage" }
  | { type: "succession_risk_created" }
  | { type: "training_resource_opportunity_cost" }
  | { type: "long_horizon_uncertainty" };

export interface FinancialStrategyRecommendation {
  id: string;
  type: FinancialStrategyRecommendationType;
  priority: SquadPlanningRecommendationPriority;
  horizon: SquadPlanningHorizon;
  playerIds?: number[];
  profile?: DevelopmentProfile;
  strategicNeedId?: string;
  financialImpact?: FinancialRecommendationImpact;
  confidence: Confidence;
  reasons: FinancialStrategyReason[];
  risks: FinancialStrategyRisk[];
}

export type MonetizationCandidateReason =
  | { type: "high_market_value" }
  | { type: "profile_overstocked" }
  | { type: "low_strategic_importance" }
  | { type: "successor_covered" }
  | { type: "limited_development_upside" }
  | { type: "core_asset" }
  | { type: "missing_successor" }
  | { type: "high_future_contribution" }
  | { type: "strong_profile_need" };

export type StrategicAssetProtection = "critical" | "high" | "normal" | "low";

export interface DevelopmentResourceCost {
  requiresAdvanced: boolean;
  projectedAdvancedRank?: number | null;
  competesWithHigherPriorityDevelopment: boolean;
}

export interface MonetizationTimingAssessment {
  playerId: number;
  currentValue: number | null;
  shortTermPeakValue: number | null;
  weeksToShortTermPeak: number | null;
  additionalValue: number | null;
  valueGainPerWeek: number | null;
  resourceCost: DevelopmentResourceCost;
  recommendation: "monetize_now" | "develop_then_monetize" | "hold_asset" | "unknown";
}

export interface MonetizationCandidateAssessment {
  playerId: number;
  profile: DevelopmentProfile | null;
  marketValue: number | null;
  squadRole: SquadDepthPlayer["role"];
  profileStatus: ProfileDepthStatus | null;
  successorCoverage: SuccessionCoverageStatus | null;
  currentContribution: number | null;
  futureContribution: number | null;
  trainingValueEfficiency: number | null;
  projectedPeakValue?: number | null;
  monetizationScore: number | null;
  strategicProtection: StrategicAssetProtection;
  timing: MonetizationTimingAssessment;
  confidence: Confidence;
  reasons: MonetizationCandidateReason[];
}

export interface SquadImpactAssessment {
  affectedProfiles: DevelopmentProfile[];
  newDepthStatuses: Partial<Record<DevelopmentProfile, ProfileDepthStatus>>;
  successionRisksCreated: number;
  corePlayersRemoved: number;
  severity: "low" | "medium" | "high";
}

export interface LiquidityScenario {
  playerIdsToMonetize: number[];
  estimatedGrossProceeds: number;
  resultingCash: number | null;
  resultingInvestmentCapacity: number | null;
  resultingSquadImpact: SquadImpactAssessment;
  financialStatus: FinancialPositionStatus;
}

export interface FinancialStrategyConflict {
  playerId?: number;
  recommendationIds: string[];
  type: "monetize_vs_develop" | "monetize_vs_squad_need" | "investment_vs_cash_preservation";
}

export interface CapitalDeploymentAssessment {
  needId: string;
  requiredCapital: number | null;
  expectedSportingImpact: number | null;
  expectedAssetValueImpact: number | null;
  efficiencyScore: number | null;
}

export interface FinancialStrategyAdvancedResource {
  playerId: number;
  requiresAdvanced: boolean;
  projectedAdvancedRank?: number | null;
  competesWithHigherPriorityDevelopment?: boolean;
}

export interface FinancialStrategyContext extends CapitalAllocationContext {
  allocation: CapitalAllocationPlan;
  advancedResources?: readonly FinancialStrategyAdvancedResource[];
}

export interface FinancialStrategyPlan {
  recommendations: FinancialStrategyRecommendation[];
  monetizationCandidates: MonetizationCandidateAssessment[];
  conflicts: FinancialStrategyConflict[];
  liquidityScenarios: LiquidityScenario[];
  deploymentAssessments: CapitalDeploymentAssessment[];
  summary: {
    preserveCash: boolean;
    investableCapital: number;
    strategicFundingGap: number;
    monetizationPotential: number | null;
    protectedAssetCount: number;
  };
  confidence: Confidence;
}

export interface FinancialStrategyConfig {
  shortTermTrainingHorizonWeeks: number;
  developBeforeMonetizingValueGainPerWeek: number;
  monetizationScoreThreshold: number;
  highFutureContributionThreshold: number;
  highMarketValuePercentile: number;
  strongNeedDepthStatuses: readonly ProfileDepthStatus[];
  criticalProtectionRoles: readonly SquadDepthPlayer["role"][];
  defaultRecommendationConfidence: Confidence;
}

export interface FinancialStrategyDiagnostics {
  allocation: CapitalAllocationPlan;
  candidates: readonly MonetizationCandidateAssessment[];
  scenarios: readonly LiquidityScenario[];
  timing: readonly MonetizationTimingAssessment[];
  generatedAt?: CapitalTiming;
}

export type { CapitalAllocationContext };
