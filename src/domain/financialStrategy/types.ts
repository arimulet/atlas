import type { Confidence } from "../types.js";
import type {
  PlayerMarketValueProjection,
  SquadMarketValueAssessment
} from "../playerMarketValue/index.js";
import type { SquadAssessment, SquadRole } from "../squadPlanning/index.js";

export type FinancialMetricProvenance = "observed" | "derived" | "projected";

export type FinancialPositionStatus = "strong" | "healthy" | "watch" | "strained" | "unknown";

export interface FinancialClubInput {
  budget: number | null;
  currency?: string | null;
}

export interface FinancialPlayerInput {
  playerId: number;
  wage: number | null;
  active?: boolean;
  squadRole?: SquadRole | null;
}

export interface FinancialTrainerInput {
  trainerId?: number | string | null;
  salary?: number | null;
  info?: { salary?: number | null } | null;
  active?: boolean;
  contracted?: boolean;
}

export interface FinancialHistoryPoint {
  gameWeek?: number | null;
  observedAt?: Date | string | null;
  budget: number | null;
  playersWeekly?: number | null;
  trainersWeekly?: number | null;
  squadAssetValue?: number | null;
}

export interface FinancialPositionContext {
  club: FinancialClubInput;
  players: readonly FinancialPlayerInput[];
  trainers: readonly FinancialTrainerInput[];
  squadMarketValue?: SquadMarketValueAssessment | null;
  squadAssessment?: SquadAssessment | null;
  marketProjections?: readonly PlayerMarketValueProjection[];
  squadPlayerCount?: number | null;
  historicalSnapshots?: readonly FinancialHistoryPoint[];
}

export interface KnownPayrollAssessment {
  playersWeekly: number;
  trainersWeekly: number;
  totalWeekly: number;
  composition: PayrollComposition;
  coverage: number;
}

export interface PayrollComposition {
  playerShare: number;
  trainerShare: number;
}

export interface SquadAssetAssessment {
  expected: number | null;
  low: number | null;
  high: number | null;
  coverage: number;
  valuedPlayers: number;
  totalPlayers: number;
  concentration: FinancialAssetConcentration | null;
  distribution: SquadAssetDistribution | null;
}

export interface FinancialAssetConcentration {
  top1Share: number | null;
  top3Share: number | null;
  top5Share: number | null;
}

export interface SquadAssetDistribution {
  core: number;
  developing: number;
  prospect: number;
  rotation: number;
  depth: number;
  transition: number;
}

export interface FinancialSafetyMetrics {
  payrollCoverageWeeks: number | null;
  cashToSquadValueRatio: number | null;
  liquidityRatio: number | null;
  payrollToCashRatio: number | null;
  assetConcentration: FinancialAssetConcentration | null;
}

export interface DevelopmentCapital {
  currentValue: number | null;
  projectedTargetValue: number | null;
  projectedValueCreation: number | null;
  playersCovered: number;
  projectionCoverage: number;
  confidence: Confidence;
}

export type FinancialPositionWarning =
  | { type: "low_known_payroll_coverage"; weeks: number }
  | { type: "low_liquidity"; ratio: number }
  | { type: "high_asset_concentration"; topPlayers: number; share: number }
  | { type: "incomplete_market_value_coverage"; coverage: number }
  | { type: "incomplete_projection_coverage"; coverage: number }
  | { type: "missing_payroll_data" };

export type FinancialPositionStrength =
  | { type: "strong_cash_buffer" }
  | { type: "healthy_liquidity" }
  | { type: "strong_development_value_pipeline" }
  | { type: "well_diversified_squad_assets" };

export interface ClubFinancialPosition {
  cash: number | null;
  squadAssetValue: SquadAssetAssessment;
  knownPayroll: KnownPayrollAssessment;
  knownCapital: {
    expected: number | null;
    liquid: number | null;
    illiquid: number | null;
  };
  metrics: FinancialSafetyMetrics;
  status: FinancialPositionStatus;
  confidence: Confidence;
  provenance: {
    cash: FinancialMetricProvenance;
    knownPayroll: FinancialMetricProvenance;
    squadAssetValue: FinancialMetricProvenance;
    knownCapital: FinancialMetricProvenance;
    metrics: FinancialMetricProvenance;
    developmentCapital: FinancialMetricProvenance;
  };
  warnings: FinancialPositionWarning[];
}

export interface CashTrend {
  current: number;
  previous: number | null;
  change: number | null;
  changePercent: number | null;
}

export interface ClubFinancialAssessment {
  position: ClubFinancialPosition;
  payroll: KnownPayrollAssessment;
  squadAssets: SquadAssetAssessment;
  developmentCapital: DevelopmentCapital | null;
  trends: {
    cash: CashTrend | null;
  };
  strengths: FinancialPositionStrength[];
  warnings: FinancialPositionWarning[];
  confidence: Confidence;
}

export interface FinancialSafetyConfig {
  strongPayrollCoverageWeeks: number;
  healthyPayrollCoverageWeeks: number;
  watchPayrollCoverageWeeks: number;
  strainedPayrollCoverageWeeks: number;
  strongLiquidityRatio: number;
  healthyLiquidityRatio: number;
  strainedLiquidityRatio: number;
  concentrationWarningThreshold: number;
  minimumStrongMarketCoverage: number;
  minimumHealthyMarketCoverage: number;
  minimumProjectionCoverageForStrength: number;
  minimumConcentrationSampleSize: number;
}
