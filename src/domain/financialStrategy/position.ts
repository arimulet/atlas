import type { Confidence } from "../types.js";
import type { PlayerMarketValueProjection } from "../playerMarketValue/index.js";
import type {
  ClubFinancialAssessment,
  ClubFinancialPosition,
  DevelopmentCapital,
  FinancialHistoryPoint,
  FinancialPositionContext,
  FinancialPositionStrength,
  FinancialPositionWarning,
  FinancialSafetyConfig,
  KnownPayrollAssessment,
  SquadAssetAssessment,
  SquadAssetDistribution,
  CashTrend
} from "./types.js";

export const FINANCIAL_SAFETY_CONFIG: FinancialSafetyConfig = {
  // These thresholds apply only to known payroll coverage, not to full cash-flow runway.
  strongPayrollCoverageWeeks: 52,
  healthyPayrollCoverageWeeks: 20,
  watchPayrollCoverageWeeks: 12,
  strainedPayrollCoverageWeeks: 6,
  // Liquidity is cash divided by observed cash plus estimated squad assets.
  strongLiquidityRatio: 0.45,
  healthyLiquidityRatio: 0.2,
  strainedLiquidityRatio: 0.15,
  // Top-three concentration is a warning only when the observed squad is large enough.
  concentrationWarningThreshold: 0.5,
  // Coverage needed before a status can be considered strong or healthy.
  minimumStrongMarketCoverage: 0.9,
  minimumHealthyMarketCoverage: 0.75,
  minimumProjectionCoverageForStrength: 0.5,
  minimumConcentrationSampleSize: 5
};

export function buildClubFinancialPosition(
  context: FinancialPositionContext,
  config: FinancialSafetyConfig = FINANCIAL_SAFETY_CONFIG
): ClubFinancialPosition {
  const payroll = calculateKnownPayroll(context);
  const squadAssets = calculateSquadAssets(context);
  const developmentCapital = calculateDevelopmentCapital(
    context.marketProjections ?? [],
    context.squadPlayerCount
  );
  const cash = readFinite(context.club.budget);
  const metrics = calculateSafetyMetrics(cash, payroll.totalWeekly, squadAssets.expected);
  metrics.assetConcentration = squadAssets.concentration;
  const warnings = buildWarnings({
    payroll,
    squadAssets,
    developmentCapital,
    metrics,
    config,
    hasPlayers: context.players.length > 0 || context.trainers.length > 0
  });
  const confidence = calculatePositionConfidence({
    cash,
    payroll,
    squadAssets,
    developmentCapital,
    hasHistoricalData: Boolean(context.historicalSnapshots?.length)
  });
  const status = deriveStatus({
    cash,
    squadAssets,
    metrics,
    confidence,
    config,
    warnings
  });
  const knownCapitalExpected =
    cash !== null && squadAssets.expected !== null ? cash + squadAssets.expected : null;

  return {
    cash,
    squadAssetValue: squadAssets,
    knownPayroll: payroll,
    knownCapital: {
      expected: knownCapitalExpected,
      liquid: cash,
      illiquid: squadAssets.expected
    },
    metrics,
    status,
    confidence,
    provenance: {
      cash: "observed",
      knownPayroll: "derived",
      squadAssetValue: "derived",
      knownCapital: "derived",
      metrics: "derived",
      developmentCapital: "projected"
    },
    warnings
  };
}

export function assessClubFinancialPosition(
  context: FinancialPositionContext,
  config: FinancialSafetyConfig = FINANCIAL_SAFETY_CONFIG
): ClubFinancialAssessment {
  const position = buildClubFinancialPosition(context, config);
  const developmentCapital = calculateDevelopmentCapital(
    context.marketProjections ?? [],
    context.squadPlayerCount
  );
  const strengths = buildStrengths(position, developmentCapital, config);

  return {
    position,
    payroll: position.knownPayroll,
    squadAssets: position.squadAssetValue,
    developmentCapital,
    trends: { cash: calculateCashTrend(context.historicalSnapshots ?? []) },
    strengths,
    warnings: position.warnings,
    confidence: position.confidence
  };
}

function calculateKnownPayroll(context: FinancialPositionContext): KnownPayrollAssessment {
  const playerWages = context.players
    .filter((player) => player.active !== false)
    .map((player) => readFinite(player.wage))
    .filter((wage): wage is number => wage !== null && wage >= 0);
  const trainerWages = new Map<string, number>();

  for (const trainer of context.trainers) {
    if (trainer.active === false || trainer.contracted === false) continue;
    const salary = readFinite(trainer.salary ?? trainer.info?.salary);
    if (salary === null || salary < 0) continue;
    const identity =
      trainer.trainerId === null || trainer.trainerId === undefined
        ? `anonymous:${trainerWages.size}`
        : String(trainer.trainerId);
    if (!trainerWages.has(identity)) trainerWages.set(identity, salary);
  }

  const playersWeekly = sum(playerWages);
  const trainersWeekly = sum([...trainerWages.values()]);
  const totalWeekly = playersWeekly + trainersWeekly;

  return {
    playersWeekly,
    trainersWeekly,
    totalWeekly,
    composition: {
      playerShare: totalWeekly > 0 ? playersWeekly / totalWeekly : 0,
      trainerShare: totalWeekly > 0 ? trainersWeekly / totalWeekly : 0
    },
    coverage: playerWages.length + trainerWages.size > 0 ? 1 : 0
  };
}

function calculateSquadAssets(context: FinancialPositionContext): SquadAssetAssessment {
  const marketValue = context.squadMarketValue;
  const estimates = marketValue?.players ?? [];
  const values = estimates
    .map((estimate) => estimate.estimatedValue.expected)
    .filter((value): value is number => Number.isFinite(value) && value >= 0);
  const expected =
    values.length > 0 ? (finiteOrNull(marketValue?.totalEstimatedValue) ?? sum(values)) : null;
  const lowValues = estimates.map((estimate) => estimate.estimatedValue.low).filter(isFiniteNumber);
  const highValues = estimates
    .map((estimate) => estimate.estimatedValue.high)
    .filter(isFiniteNumber);
  const totalPlayers = Math.max(0, context.squadPlayerCount ?? estimates.length);
  const coverage = totalPlayers > 0 ? clamp(values.length / totalPlayers, 0, 1) : 0;
  const sortedValues = [...values].sort((left, right) => right - left);

  return {
    expected,
    low: lowValues.length === values.length && values.length > 0 ? sum(lowValues) : null,
    high: highValues.length === values.length && values.length > 0 ? sum(highValues) : null,
    coverage,
    valuedPlayers: values.length,
    totalPlayers,
    concentration:
      expected !== null && expected > 0
        ? {
            top1Share: shareOf(sortedValues, expected, 1),
            top3Share: shareOf(sortedValues, expected, 3),
            top5Share: shareOf(sortedValues, expected, 5)
          }
        : null,
    distribution: buildAssetDistribution(context, marketValue)
  };
}

function buildAssetDistribution(
  context: FinancialPositionContext,
  marketValue: FinancialPositionContext["squadMarketValue"]
): SquadAssetDistribution | null {
  if (!context.squadAssessment || !marketValue) return null;
  const estimates = new Map(
    marketValue.players.map((estimate) => [estimate.playerId, estimate.estimatedValue.expected])
  );
  const distribution: SquadAssetDistribution = {
    core: 0,
    developing: 0,
    prospect: 0,
    rotation: 0,
    depth: 0,
    transition: 0
  };
  let assigned = false;

  for (const player of context.squadAssessment.players) {
    const value = estimates.get(player.playerId);
    if (!Number.isFinite(value) || value === undefined || !(player.role in distribution)) continue;
    distribution[player.role] += value;
    assigned = true;
  }
  return assigned ? distribution : null;
}

function calculateDevelopmentCapital(
  projections: readonly PlayerMarketValueProjection[],
  squadPlayerCount: number | null | undefined
): DevelopmentCapital | null {
  if (projections.length === 0) return null;
  const covered = projections
    .map((projection) => ({
      current: finiteOrNull(projection.current.calibratedValue.expected),
      target: finiteOrNull(projection.completion?.marketValue?.expected)
    }))
    .filter(
      (item): item is { current: number; target: number } =>
        item.current !== null && item.target !== null
    );
  const currentValue = covered.length > 0 ? sum(covered.map((item) => item.current)) : null;
  const projectedTargetValue = covered.length > 0 ? sum(covered.map((item) => item.target)) : null;
  const targetCount = Math.max(0, squadPlayerCount ?? projections.length);
  return {
    currentValue,
    projectedTargetValue,
    projectedValueCreation:
      currentValue !== null && projectedTargetValue !== null
        ? projectedTargetValue - currentValue
        : null,
    playersCovered: covered.length,
    projectionCoverage: targetCount > 0 ? clamp(covered.length / targetCount, 0, 1) : 0,
    confidence: aggregateConfidence(projections.map((projection) => projection.confidence))
  };
}

function calculateSafetyMetrics(
  cash: number | null,
  payroll: number,
  squadValue: number | null
): ClubFinancialPosition["metrics"] {
  return {
    payrollCoverageWeeks: cash !== null && payroll > 0 ? cash / payroll : null,
    cashToSquadValueRatio:
      cash !== null && squadValue !== null && squadValue > 0 ? cash / squadValue : null,
    liquidityRatio:
      cash !== null && squadValue !== null && cash + squadValue > 0
        ? clamp(cash / (cash + squadValue), 0, 1)
        : null,
    payrollToCashRatio: cash !== null && cash > 0 && payroll >= 0 ? payroll / cash : null,
    assetConcentration: null
  };
}

function buildWarnings(input: {
  payroll: KnownPayrollAssessment;
  squadAssets: SquadAssetAssessment;
  developmentCapital: DevelopmentCapital | null;
  metrics: ClubFinancialPosition["metrics"];
  config: FinancialSafetyConfig;
  hasPlayers: boolean;
}): FinancialPositionWarning[] {
  const warnings: FinancialPositionWarning[] = [];
  const concentration = input.squadAssets.concentration;
  if (
    input.metrics.payrollCoverageWeeks !== null &&
    input.metrics.payrollCoverageWeeks < input.config.watchPayrollCoverageWeeks
  ) {
    warnings.push({
      type: "low_known_payroll_coverage",
      weeks: input.metrics.payrollCoverageWeeks
    });
  }
  if (
    input.metrics.liquidityRatio !== null &&
    input.metrics.liquidityRatio < input.config.healthyLiquidityRatio
  ) {
    warnings.push({ type: "low_liquidity", ratio: input.metrics.liquidityRatio });
  }
  if (
    concentration &&
    input.squadAssets.totalPlayers >= input.config.minimumConcentrationSampleSize &&
    concentration.top3Share !== null &&
    concentration.top3Share >= input.config.concentrationWarningThreshold
  ) {
    warnings.push({
      type: "high_asset_concentration",
      topPlayers: 3,
      share: concentration.top3Share
    });
  }
  if (input.squadAssets.totalPlayers > 0 && input.squadAssets.coverage < 1) {
    warnings.push({
      type: "incomplete_market_value_coverage",
      coverage: input.squadAssets.coverage
    });
  }
  if (input.developmentCapital !== null && input.developmentCapital.projectionCoverage < 1) {
    warnings.push({
      type: "incomplete_projection_coverage",
      coverage: input.developmentCapital.projectionCoverage
    });
  }
  if (!input.hasPlayers || input.payroll.coverage === 0)
    warnings.push({ type: "missing_payroll_data" });
  return warnings;
}

function calculatePositionConfidence(input: {
  cash: number | null;
  payroll: KnownPayrollAssessment;
  squadAssets: SquadAssetAssessment;
  developmentCapital: DevelopmentCapital | null;
  hasHistoricalData: boolean;
}): Confidence {
  if (input.cash === null) return "low";
  const evidence = [
    input.payroll.coverage > 0,
    input.squadAssets.coverage >= 0.75,
    input.developmentCapital === null || input.developmentCapital.projectionCoverage >= 0.5,
    input.hasHistoricalData
  ].filter(Boolean).length;
  if (evidence >= 3 && input.squadAssets.coverage >= 0.9) return "high";
  if (evidence >= 1) return "medium";
  return "low";
}

function deriveStatus(input: {
  cash: number | null;
  squadAssets: SquadAssetAssessment;
  metrics: ClubFinancialPosition["metrics"];
  confidence: Confidence;
  config: FinancialSafetyConfig;
  warnings: readonly FinancialPositionWarning[];
}): ClubFinancialPosition["status"] {
  if (input.cash === null) return "unknown";
  if (input.metrics.payrollCoverageWeeks === null && input.metrics.liquidityRatio === null)
    return "unknown";
  if (
    input.metrics.payrollCoverageWeeks !== null &&
    input.metrics.payrollCoverageWeeks < input.config.strainedPayrollCoverageWeeks
  )
    return "strained";
  if (
    input.metrics.liquidityRatio !== null &&
    input.metrics.liquidityRatio < input.config.strainedLiquidityRatio &&
    input.metrics.payrollCoverageWeeks !== null &&
    input.metrics.payrollCoverageWeeks < input.config.watchPayrollCoverageWeeks
  )
    return "strained";
  if (input.metrics.payrollCoverageWeeks === null || input.metrics.liquidityRatio === null)
    return "watch";
  if (
    input.metrics.payrollCoverageWeeks >= input.config.strongPayrollCoverageWeeks &&
    input.metrics.liquidityRatio >= input.config.strongLiquidityRatio &&
    input.squadAssets.coverage >= input.config.minimumStrongMarketCoverage &&
    input.confidence !== "low" &&
    input.warnings.length === 0
  )
    return "strong";
  if (
    input.metrics.payrollCoverageWeeks >= input.config.healthyPayrollCoverageWeeks &&
    input.metrics.liquidityRatio >= input.config.healthyLiquidityRatio &&
    input.squadAssets.coverage >= input.config.minimumHealthyMarketCoverage &&
    input.confidence !== "low" &&
    !input.warnings.some((warning) => warning.type === "high_asset_concentration")
  )
    return "healthy";
  return "watch";
}

function buildStrengths(
  position: ClubFinancialPosition,
  developmentCapital: DevelopmentCapital | null,
  config: FinancialSafetyConfig
): FinancialPositionStrength[] {
  const strengths: FinancialPositionStrength[] = [];
  if (
    position.metrics.payrollCoverageWeeks !== null &&
    position.metrics.payrollCoverageWeeks >= config.strongPayrollCoverageWeeks
  )
    strengths.push({ type: "strong_cash_buffer" });
  if (
    position.metrics.liquidityRatio !== null &&
    position.metrics.liquidityRatio >= config.healthyLiquidityRatio
  )
    strengths.push({ type: "healthy_liquidity" });
  if (
    developmentCapital?.projectedValueCreation !== null &&
    developmentCapital?.projectedValueCreation !== undefined &&
    developmentCapital.projectedValueCreation > 0 &&
    developmentCapital.projectionCoverage >= config.minimumProjectionCoverageForStrength
  )
    strengths.push({ type: "strong_development_value_pipeline" });
  const concentration = position.squadAssetValue.concentration;
  if (
    concentration &&
    concentration.top3Share !== null &&
    concentration.top3Share < config.concentrationWarningThreshold
  )
    strengths.push({ type: "well_diversified_squad_assets" });
  return strengths;
}

function calculateCashTrend(points: readonly FinancialHistoryPoint[]): CashTrend | null {
  const valid = points
    .filter(
      (point): point is FinancialHistoryPoint & { budget: number } =>
        readFinite(point.budget) !== null
    )
    .sort(compareHistory);
  const current = valid.at(-1)?.budget;
  if (current === undefined) return null;
  const previous = valid.at(-2)?.budget ?? null;
  const change = previous === null ? null : current - previous;
  return {
    current,
    previous,
    change,
    changePercent: previous !== null && previous !== 0 ? change! / Math.abs(previous) : null
  };
}

function compareHistory(left: FinancialHistoryPoint, right: FinancialHistoryPoint): number {
  if (
    left.gameWeek !== null &&
    left.gameWeek !== undefined &&
    right.gameWeek !== null &&
    right.gameWeek !== undefined
  )
    return left.gameWeek - right.gameWeek;
  return String(left.observedAt ?? "").localeCompare(String(right.observedAt ?? ""));
}

function aggregateConfidence(values: readonly Confidence[]): Confidence {
  if (values.length === 0) return "low";
  if (values.some((value) => value === "low")) return "low";
  if (values.every((value) => value === "high")) return "high";
  return "medium";
}

function shareOf(values: readonly number[], total: number, count: number): number | null {
  return total > 0 && values.length > 0 ? sum(values.slice(0, count)) / total : null;
}

function readFinite(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function finiteOrNull(value: number | null | undefined): number | null {
  return readFinite(value);
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return readFinite(value) !== null;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
