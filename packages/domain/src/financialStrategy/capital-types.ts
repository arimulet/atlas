import type { Confidence } from "../types.js";
import type {
  PlayerMarketValueEstimate,
  PlayerMarketValueProjection
} from "../playerMarketValue/index.js";
import type { DevelopmentProfile } from "../playerDevelopment/index.js";
import type {
  ProfileDepthAssessment,
  SquadDepthAnalysis,
  SquadDepthPlayer,
  SquadPlanningHorizon,
  SquadPlanningRecommendationPriority,
  SquadPlanningRecommendations
} from "../squadPlanning/index.js";
import type { ClubFinancialAssessment, FinancialPositionStatus } from "./types.js";

export type CapitalAllocationStatus = "ample" | "sufficient" | "tight" | "insufficient" | "unknown";

export type CapitalTiming = "now" | "next_season" | "medium_term";

export interface FinancialReserve {
  minimumCashReserve: number | null;
  reserveBasis: {
    knownPayrollWeeks: number;
    amountFromPayroll: number | null;
    additionalSafetyBuffer: number | null;
  };
  confidence: Confidence;
}

export interface SpendableCash {
  cash: number | null;
  reservedCash: number | null;
  availableCash: number | null;
}

export interface InvestmentCapacity {
  immediate: number | null;
  conservative: number | null;
  maximumRecommended: number | null;
  confidence: Confidence;
}

export interface HorizonInvestmentCapacity {
  current: number | null;
  nextSeason: number | null;
  mediumTerm: number | null;
}

export interface CapitalRequirementRange {
  low: number;
  expected: number;
  high: number;
}

export interface RecruitmentProfileTarget {
  profile: DevelopmentProfile;
  minimumContribution: number | null;
  horizon: SquadPlanningHorizon;
  approximateSkills?: Readonly<Record<string, number>>;
}

export type StrategicCapitalNeedType = "external_recruitment" | "development_support";

export interface StrategicCapitalNeed {
  id: string;
  profile: DevelopmentProfile;
  sourceRecommendationId: string;
  horizon: SquadPlanningHorizon;
  priority: SquadPlanningRecommendationPriority;
  type: StrategicCapitalNeedType;
  estimatedCapitalRequirement: CapitalRequirementRange | null;
  target: RecruitmentProfileTarget | null;
  confidence: Confidence;
}

export type CapitalFundingCoverage =
  "fully_funded" | "partially_funded" | "unfunded" | "not_cash_dependent";

export interface CapitalAllocationItem {
  strategicNeedId: string;
  allocatedAmount: number;
  requiredRange: CapitalRequirementRange | null;
  coverage: CapitalFundingCoverage;
  priority: SquadPlanningRecommendationPriority;
  timing: CapitalTiming;
}

export interface StrategicFundingGap {
  strategicNeedId: string;
  expectedRequirement: number;
  allocated: number;
  gap: number;
  severity: SquadPlanningRecommendationPriority;
}

export interface MonetizableAssetAssessment {
  playerId: number;
  estimatedMarketValue: number | null;
  squadRole: SquadDepthPlayer["role"];
  strategicImportance: number | null;
  liquidityPotential: "high" | "medium" | "low";
  confidence: Confidence;
}

export interface CapitalOpportunityCost {
  cashLiquidityCost: number | null;
  sportingAssetCost: number | null;
}

export interface ExtendedInvestmentCapacity {
  cashBacked: number | null;
  potentialAssetLiquidity: number | null;
  theoreticalMaximum: number | null;
}

export type CapitalAllocationReason =
  | { type: "strong_cash_buffer" }
  | { type: "reserve_protected"; amount: number }
  | { type: "priority_need_fully_funded"; needId: string }
  | { type: "priority_need_underfunded"; needId: string; gap: number }
  | {
      type: "investment_would_reduce_financial_status";
      from: FinancialPositionStatus;
      to: FinancialPositionStatus;
    }
  | { type: "potential_asset_liquidity_available"; amount: number };

export interface InvestmentSafetyAssessment {
  amount: number;
  postInvestmentCash: number | null;
  postInvestmentStatus: FinancialPositionStatus;
  postInvestmentPayrollCoverageWeeks: number | null;
  postInvestmentLiquidityRatio: number | null;
  safety: "safe" | "acceptable" | "aggressive" | "unsafe";
  reasons: CapitalAllocationReason[];
}

export interface CapitalAllocationPlan {
  cash: number | null;
  reserve: FinancialReserve;
  spendableCash: SpendableCash;
  investmentCapacity: InvestmentCapacity;
  horizonCapacity: HorizonInvestmentCapacity;
  strategicNeeds: StrategicCapitalNeed[];
  allocation: CapitalAllocationItem[];
  fundingGaps: StrategicFundingGap[];
  unallocatedCapacity: number | null;
  status: CapitalAllocationStatus;
  confidence: Confidence;
  reasons: CapitalAllocationReason[];
  monetizableAssets: MonetizableAssetAssessment[];
  potentialAssetLiquidity: number | null;
  extendedCapacity: ExtendedInvestmentCapacity;
  opportunityCost: CapitalOpportunityCost;
}

export interface CapitalAllocationContext {
  financialAssessment: ClubFinancialAssessment;
  squadPlanning: SquadPlanningRecommendations;
  depthAnalysis: SquadDepthAnalysis;
  playerMarketValues?: readonly PlayerMarketValueEstimate[];
  marketProjections?: readonly PlayerMarketValueProjection[];
  squadPlayers?: readonly SquadDepthPlayer[];
  playerProfiles?: readonly { playerId: number; profile: DevelopmentProfile | null }[];
}

export interface CapitalAllocationConfig {
  minimumKnownPayrollReserveWeeks: number;
  additionalSafetyBufferWeeksByStatus: Readonly<Record<FinancialPositionStatus, number>>;
  conservativeUtilizationByStatus: Readonly<Record<FinancialPositionStatus, number>>;
  maximumUtilizationByStatus: Readonly<Record<FinancialPositionStatus, number>>;
  safePostInvestmentStatuses: readonly FinancialPositionStatus[];
  acceptablePostInvestmentStatuses: readonly FinancialPositionStatus[];
  strongAssetLiquidityImportance: number;
  marketReferenceMinimumConfidence: Confidence;
}

export interface CapitalAllocationDiagnostics {
  profileDepth: readonly ProfileDepthAssessment[];
  cashBackedCapacity: number | null;
  potentialAssetLiquidity: number | null;
}
