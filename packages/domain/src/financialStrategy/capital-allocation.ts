import type { Confidence } from "../types.js";
import type { DevelopmentProfile } from "../playerDevelopment/index.js";
import type {
  SquadDepthPlayer,
  SquadPlanningHorizon,
  SquadPlanningRecommendation,
  SquadPlanningRecommendationPriority
} from "../squadPlanning/index.js";
import { FINANCIAL_SAFETY_CONFIG } from "./position.js";
import type {
  CapitalAllocationConfig,
  CapitalAllocationContext,
  CapitalAllocationItem,
  CapitalAllocationPlan,
  CapitalAllocationReason,
  CapitalFundingCoverage,
  CapitalRequirementRange,
  CapitalTiming,
  CapitalAllocationStatus,
  ExtendedInvestmentCapacity,
  FinancialReserve,
  InvestmentCapacity,
  InvestmentSafetyAssessment,
  MonetizableAssetAssessment,
  RecruitmentProfileTarget,
  SpendableCash,
  StrategicCapitalNeed,
  StrategicFundingGap
} from "./capital-types.js";
import type {
  ClubFinancialAssessment,
  ClubFinancialPosition,
  FinancialPositionStatus
} from "./types.js";

export const FINANCIAL_STRATEGY_CONFIG: CapitalAllocationConfig = {
  // This is known payroll coverage, not a complete operating-expense runway.
  minimumKnownPayrollReserveWeeks: 10,
  additionalSafetyBufferWeeksByStatus: {
    strong: 0,
    healthy: 0,
    watch: 4,
    strained: 8,
    unknown: 10
  },
  conservativeUtilizationByStatus: {
    strong: 0.65,
    healthy: 0.55,
    watch: 0.3,
    strained: 0,
    unknown: 0
  },
  maximumUtilizationByStatus: {
    strong: 0.9,
    healthy: 0.75,
    watch: 0.45,
    strained: 0,
    unknown: 0
  },
  safePostInvestmentStatuses: ["strong", "healthy"],
  acceptablePostInvestmentStatuses: ["strong", "healthy", "watch"],
  strongAssetLiquidityImportance: 0.4,
  marketReferenceMinimumConfidence: "medium"
};

export function buildCapitalAllocationPlan(
  context: CapitalAllocationContext,
  config: CapitalAllocationConfig = FINANCIAL_STRATEGY_CONFIG
): CapitalAllocationPlan {
  const position = context.financialAssessment.position;
  const reserve = calculateFinancialReserve(position, config);
  const spendableCash = calculateSpendableCash(position.cash, reserve);
  const investmentCapacity = calculateInvestmentCapacity(position, spendableCash, config);
  const strategicNeeds = estimateStrategicCapitalNeeds(context, config);
  const allocationResult = allocateCapital(strategicNeeds, investmentCapacity.conservative);
  const monetizableAssets = assessMonetizableAssets(context, config);
  const potentialAssetLiquidity = sum(
    monetizableAssets
      .filter((asset) => asset.liquidityPotential !== "low")
      .map((asset) => asset.estimatedMarketValue)
      .filter(isFiniteNumber)
  );
  const extendedCapacity = buildExtendedCapacity(investmentCapacity, potentialAssetLiquidity);
  const reasons = buildAllocationReasons(
    position,
    reserve,
    allocationResult.items,
    allocationResult.gaps,
    potentialAssetLiquidity
  );
  const confidence = combineConfidence(
    position.confidence,
    ...strategicNeeds.map((need) => need.confidence),
    ...monetizableAssets.map((asset) => asset.confidence)
  );

  return {
    cash: position.cash,
    reserve,
    spendableCash,
    investmentCapacity,
    horizonCapacity: {
      current: investmentCapacity.maximumRecommended,
      nextSeason: investmentCapacity.maximumRecommended,
      mediumTerm: investmentCapacity.maximumRecommended
    },
    strategicNeeds,
    allocation: allocationResult.items,
    fundingGaps: allocationResult.gaps,
    unallocatedCapacity:
      investmentCapacity.conservative === null
        ? null
        : Math.max(0, investmentCapacity.conservative - allocationResult.totalAllocated),
    status: deriveCapitalAllocationStatus(
      position,
      strategicNeeds,
      allocationResult,
      investmentCapacity
    ),
    confidence,
    reasons,
    monetizableAssets,
    potentialAssetLiquidity,
    extendedCapacity,
    opportunityCost: {
      cashLiquidityCost: investmentCapacity.conservative,
      sportingAssetCost: null
    }
  };
}

export function estimateStrategicCapitalNeeds(
  context: CapitalAllocationContext,
  config: CapitalAllocationConfig = FINANCIAL_STRATEGY_CONFIG
): StrategicCapitalNeed[] {
  return context.squadPlanning.recommendations
    .filter(isCapitalRelevantRecommendation)
    .map((recommendation) => createStrategicNeed(recommendation, context, config))
    .sort(compareNeeds);
}

export function calculateFinancialReserve(
  position: ClubFinancialPosition,
  config: CapitalAllocationConfig = FINANCIAL_STRATEGY_CONFIG
): FinancialReserve {
  const payroll = position.knownPayroll.totalWeekly;
  const weeks = config.minimumKnownPayrollReserveWeeks;
  const extraWeeks = config.additionalSafetyBufferWeeksByStatus[position.status];
  const amountFromPayroll = payroll > 0 ? payroll * weeks : payroll === 0 ? 0 : null;
  const additionalSafetyBuffer = payroll > 0 ? payroll * extraWeeks : payroll === 0 ? 0 : null;
  const requestedReserve =
    amountFromPayroll !== null && additionalSafetyBuffer !== null
      ? amountFromPayroll + additionalSafetyBuffer
      : null;
  return {
    minimumCashReserve:
      position.cash !== null && requestedReserve !== null
        ? Math.min(position.cash, requestedReserve)
        : null,
    reserveBasis: {
      knownPayrollWeeks: weeks,
      amountFromPayroll,
      additionalSafetyBuffer
    },
    confidence: position.confidence === "high" && payroll > 0 ? "high" : position.confidence
  };
}

export function calculateSpendableCash(
  cash: number | null,
  reserve: FinancialReserve
): SpendableCash {
  if (cash === null || reserve.minimumCashReserve === null) {
    return { cash, reservedCash: reserve.minimumCashReserve, availableCash: null };
  }
  return {
    cash,
    reservedCash: Math.min(cash, Math.max(0, reserve.minimumCashReserve)),
    availableCash: Math.max(0, cash - Math.max(0, reserve.minimumCashReserve))
  };
}

export function calculateInvestmentCapacity(
  position: ClubFinancialPosition,
  spendableCash: SpendableCash,
  config: CapitalAllocationConfig = FINANCIAL_STRATEGY_CONFIG
): InvestmentCapacity {
  const available = spendableCash.availableCash;
  if (available === null) {
    return { immediate: null, conservative: null, maximumRecommended: null, confidence: "low" };
  }
  const conservativeFactor = config.conservativeUtilizationByStatus[position.status];
  const maximumFactor = config.maximumUtilizationByStatus[position.status];
  return {
    immediate: available,
    conservative: roundMoney(available * conservativeFactor),
    maximumRecommended: roundMoney(Math.min(available, available * maximumFactor)),
    confidence: position.confidence
  };
}

export function simulateFinancialPositionAfterCashCommitment(
  financialAssessment: ClubFinancialAssessment,
  amount: number,
  config = FINANCIAL_SAFETY_CONFIG
): ClubFinancialPosition {
  const normalizedAmount = finiteNonNegative(amount);
  return simulateFinancialPositionAfterCashChange(
    financialAssessment,
    normalizedAmount === null ? 0 : -normalizedAmount,
    config
  );
}

export function simulateFinancialPositionAfterCashChange(
  financialAssessment: ClubFinancialAssessment,
  cashDelta: number,
  config = FINANCIAL_SAFETY_CONFIG
): ClubFinancialPosition {
  const normalizedDelta =
    typeof cashDelta === "number" && Number.isFinite(cashDelta) ? cashDelta : 0;
  const cash =
    financialAssessment.position.cash === null
      ? null
      : Math.max(0, financialAssessment.position.cash + normalizedDelta);
  return rebuildPositionWithCash(financialAssessment.position, cash, config);
}

export function assessInvestmentSafety(
  financialAssessment: ClubFinancialAssessment,
  amount: number,
  config: CapitalAllocationConfig = FINANCIAL_STRATEGY_CONFIG
): InvestmentSafetyAssessment {
  const normalizedAmount = finiteNonNegative(amount) ?? 0;
  const position = financialAssessment.position;
  const reserve = calculateFinancialReserve(position, config);
  const spendable = calculateSpendableCash(position.cash, reserve);
  const capacity = calculateInvestmentCapacity(position, spendable, config);
  const simulated = simulateFinancialPositionAfterCashCommitment(
    financialAssessment,
    normalizedAmount,
    FINANCIAL_SAFETY_CONFIG
  );
  const reasons: CapitalAllocationReason[] = [];
  if (position.status !== simulated.status) {
    reasons.push({
      type: "investment_would_reduce_financial_status",
      from: position.status,
      to: simulated.status
    });
  }
  if (spendable.availableCash !== null && normalizedAmount > spendable.availableCash) {
    reasons.push({
      type: "priority_need_underfunded",
      needId: "investment",
      gap: normalizedAmount - spendable.availableCash
    });
  }
  const safety = classifyInvestmentSafety(
    normalizedAmount,
    simulated.status,
    capacity,
    spendable.availableCash,
    config
  );
  return {
    amount: normalizedAmount,
    postInvestmentCash: simulated.cash,
    postInvestmentStatus: simulated.status,
    postInvestmentPayrollCoverageWeeks: simulated.metrics.payrollCoverageWeeks,
    postInvestmentLiquidityRatio: simulated.metrics.liquidityRatio,
    safety,
    reasons
  };
}

function rebuildPositionWithCash(
  position: ClubFinancialPosition,
  cash: number | null,
  config: typeof FINANCIAL_SAFETY_CONFIG
): ClubFinancialPosition {
  const payroll = position.knownPayroll;
  const squadAssets = position.squadAssetValue;
  const metrics = {
    payrollCoverageWeeks:
      cash !== null && payroll.totalWeekly > 0 ? cash / payroll.totalWeekly : null,
    cashToSquadValueRatio:
      cash !== null && squadAssets.expected !== null && squadAssets.expected > 0
        ? cash / squadAssets.expected
        : null,
    liquidityRatio:
      cash !== null && squadAssets.expected !== null && cash + squadAssets.expected > 0
        ? Math.min(1, Math.max(0, cash / (cash + squadAssets.expected)))
        : null,
    payrollToCashRatio: cash !== null && cash > 0 ? payroll.totalWeekly / cash : null,
    assetConcentration: squadAssets.concentration
  };
  const warnings: ClubFinancialPosition["warnings"] = [
    ...position.warnings.filter(
      (warning) =>
        warning.type === "incomplete_market_value_coverage" ||
        warning.type === "incomplete_projection_coverage" ||
        warning.type === "high_asset_concentration" ||
        warning.type === "missing_payroll_data"
    )
  ];
  if (
    metrics.payrollCoverageWeeks !== null &&
    metrics.payrollCoverageWeeks < config.watchPayrollCoverageWeeks
  ) {
    warnings.push({ type: "low_known_payroll_coverage", weeks: metrics.payrollCoverageWeeks });
  }
  if (metrics.liquidityRatio !== null && metrics.liquidityRatio < config.healthyLiquidityRatio) {
    warnings.push({ type: "low_liquidity", ratio: metrics.liquidityRatio });
  }
  const status = deriveSimulatedStatus(position, metrics, warnings, config);
  return {
    ...position,
    cash,
    knownCapital: {
      ...position.knownCapital,
      expected: cash !== null && squadAssets.expected !== null ? cash + squadAssets.expected : null,
      liquid: cash
    },
    metrics,
    status,
    warnings
  };
}

function deriveSimulatedStatus(
  position: ClubFinancialPosition,
  metrics: ClubFinancialPosition["metrics"],
  warnings: readonly ClubFinancialPosition["warnings"][number][],
  config: typeof FINANCIAL_SAFETY_CONFIG
): FinancialPositionStatus {
  if (position.cash === null) return "unknown";
  if (metrics.payrollCoverageWeeks === null && metrics.liquidityRatio === null) return "unknown";
  if (
    metrics.payrollCoverageWeeks !== null &&
    metrics.payrollCoverageWeeks < config.strainedPayrollCoverageWeeks
  )
    return "strained";
  if (
    metrics.liquidityRatio !== null &&
    metrics.liquidityRatio < config.strainedLiquidityRatio &&
    metrics.payrollCoverageWeeks !== null &&
    metrics.payrollCoverageWeeks < config.watchPayrollCoverageWeeks
  )
    return "strained";
  if (metrics.payrollCoverageWeeks === null || metrics.liquidityRatio === null) return "watch";
  if (
    metrics.payrollCoverageWeeks >= config.strongPayrollCoverageWeeks &&
    metrics.liquidityRatio >= config.strongLiquidityRatio &&
    position.squadAssetValue.coverage >= config.minimumStrongMarketCoverage &&
    warnings.length === 0
  )
    return "strong";
  if (
    metrics.payrollCoverageWeeks >= config.healthyPayrollCoverageWeeks &&
    metrics.liquidityRatio >= config.healthyLiquidityRatio &&
    position.squadAssetValue.coverage >= config.minimumHealthyMarketCoverage &&
    !warnings.some((warning) => warning.type === "high_asset_concentration")
  )
    return "healthy";
  return "watch";
}

function classifyInvestmentSafety(
  amount: number,
  postStatus: FinancialPositionStatus,
  capacity: InvestmentCapacity,
  available: number | null,
  config: CapitalAllocationConfig
): InvestmentSafetyAssessment["safety"] {
  if (
    available === null ||
    amount > available ||
    postStatus === "strained" ||
    postStatus === "unknown"
  )
    return "unsafe";
  if (
    config.safePostInvestmentStatuses.includes(postStatus) &&
    capacity.conservative !== null &&
    amount <= capacity.conservative
  )
    return "safe";
  if (
    config.acceptablePostInvestmentStatuses.includes(postStatus) &&
    capacity.maximumRecommended !== null &&
    amount <= capacity.maximumRecommended
  )
    return "acceptable";
  return "aggressive";
}

function isCapitalRelevantRecommendation(recommendation: SquadPlanningRecommendation): boolean {
  return ["find_external", "prepare_successor", "accelerate_development"].includes(
    recommendation.type
  );
}

function createStrategicNeed(
  recommendation: SquadPlanningRecommendation,
  context: CapitalAllocationContext,
  config: CapitalAllocationConfig
): StrategicCapitalNeed {
  const isDevelopment =
    recommendation.type === "accelerate_development" ||
    (recommendation.type === "prepare_successor" &&
      recommendation.candidates?.some((candidate) => candidate.futureContribution !== null));
  const target: RecruitmentProfileTarget | null = isDevelopment
    ? null
    : {
        profile: recommendation.profile,
        minimumContribution: minimumContribution(recommendation, context),
        horizon: recommendation.horizon
      };
  const requirement = isDevelopment ? null : estimateRequirement(recommendation.profile, context);
  const marketConfidence = requirement
    ? confidenceForMarketReference(recommendation.profile, context)
    : "low";
  return {
    id: `capital:${recommendation.id}`,
    profile: recommendation.profile,
    sourceRecommendationId: recommendation.id,
    horizon: recommendation.horizon,
    priority: recommendation.priority,
    type: isDevelopment ? "development_support" : "external_recruitment",
    estimatedCapitalRequirement: requirement,
    target,
    confidence: combineConfidence(
      recommendation.confidence,
      marketConfidence,
      context.financialAssessment.confidence,
      config.marketReferenceMinimumConfidence === "high" ? "medium" : "high"
    )
  };
}

function estimateRequirement(
  profile: DevelopmentProfile,
  context: CapitalAllocationContext
): CapitalRequirementRange | null {
  const ids = new Set(
    context.depthAnalysis.profiles.find((item) => item.profile === profile)?.current.playerIds ?? []
  );
  const profileMap = new Map(
    (context.playerProfiles ?? []).map((item) => [item.playerId, item.profile])
  );
  const references = (context.playerMarketValues ?? []).filter((estimate) => {
    const mappedProfile = profileMap.get(estimate.playerId);
    return mappedProfile === profile || (mappedProfile === undefined && ids.has(estimate.playerId));
  });
  if (references.length === 0) return null;
  const lows = references.map((reference) => reference.estimatedValue.low).filter(isFiniteNumber);
  const expected = references
    .map((reference) => reference.estimatedValue.expected)
    .filter(isFiniteNumber)
    .sort((left, right) => left - right);
  const highs = references.map((reference) => reference.estimatedValue.high).filter(isFiniteNumber);
  const medianExpected = expected[Math.floor(expected.length / 2)];
  if (lows.length === 0 || highs.length === 0 || medianExpected === undefined) return null;
  return { low: Math.min(...lows), expected: medianExpected, high: Math.max(...highs) };
}

function confidenceForMarketReference(
  profile: DevelopmentProfile,
  context: CapitalAllocationContext
): Confidence {
  const profileIds = new Set(
    context.depthAnalysis.profiles.find((item) => item.profile === profile)?.current.playerIds ?? []
  );
  const confidence = (context.playerMarketValues ?? [])
    .filter((estimate) => profileIds.has(estimate.playerId))
    .map((estimate) => estimate.confidence);
  return confidence.length > 0 ? combineConfidence(...confidence) : "low";
}

function minimumContribution(
  recommendation: SquadPlanningRecommendation,
  context: CapitalAllocationContext
): number | null {
  const candidates =
    recommendation.candidates
      ?.map((candidate) => candidate.futureContribution)
      .filter(isFiniteNumber) ?? [];
  if (candidates.length > 0) return Math.max(...candidates);
  const profile = context.depthAnalysis.profiles.find(
    (item) => item.profile === recommendation.profile
  );
  return profile?.nextSeason.depthScore ?? null;
}

function allocateCapital(
  needs: readonly StrategicCapitalNeed[],
  capacity: number | null
): { items: CapitalAllocationItem[]; gaps: StrategicFundingGap[]; totalAllocated: number } {
  let remaining = capacity ?? 0;
  const items: CapitalAllocationItem[] = [];
  const gaps: StrategicFundingGap[] = [];
  for (const need of needs) {
    const timing = toCapitalTiming(need.horizon);
    const requirement = need.estimatedCapitalRequirement;
    if (need.type === "development_support" || requirement === null) {
      items.push({
        strategicNeedId: need.id,
        allocatedAmount: 0,
        requiredRange: requirement,
        coverage: need.type === "development_support" ? "not_cash_dependent" : "unfunded",
        priority: need.priority,
        timing
      });
      if (requirement !== null)
        gaps.push({
          strategicNeedId: need.id,
          expectedRequirement: requirement.expected,
          allocated: 0,
          gap: requirement.expected,
          severity: need.priority
        });
      continue;
    }
    if (timing === "medium_term") {
      items.push({
        strategicNeedId: need.id,
        allocatedAmount: 0,
        requiredRange: requirement,
        coverage: "unfunded",
        priority: need.priority,
        timing
      });
      gaps.push({
        strategicNeedId: need.id,
        expectedRequirement: requirement.expected,
        allocated: 0,
        gap: requirement.expected,
        severity: need.priority
      });
      continue;
    }
    const allocatedAmount = Math.min(remaining, requirement.expected);
    remaining = Math.max(0, remaining - allocatedAmount);
    const coverage = coverageForAllocation(allocatedAmount, requirement.expected);
    items.push({
      strategicNeedId: need.id,
      allocatedAmount,
      requiredRange: requirement,
      coverage,
      priority: need.priority,
      timing
    });
    if (allocatedAmount < requirement.expected)
      gaps.push({
        strategicNeedId: need.id,
        expectedRequirement: requirement.expected,
        allocated: allocatedAmount,
        gap: requirement.expected - allocatedAmount,
        severity: need.priority
      });
  }
  return { items, gaps, totalAllocated: (capacity ?? 0) - remaining };
}

function assessMonetizableAssets(
  context: CapitalAllocationContext,
  config: CapitalAllocationConfig
): MonetizableAssetAssessment[] {
  const players = context.squadPlayers ?? [];
  const estimates = new Map(
    (context.playerMarketValues ?? []).map((estimate) => [estimate.playerId, estimate])
  );
  const overstockedProfiles = new Set(
    context.depthAnalysis.profiles
      .filter((profile) => profile.status === "overstocked")
      .map((profile) => profile.profile)
  );
  return players
    .map((player) => {
      const estimate = estimates.get(player.playerId);
      const isOverstocked = overstockedProfiles.has(player.profile ?? ("" as DevelopmentProfile));
      const liquidityPotential: MonetizableAssetAssessment["liquidityPotential"] =
        player.role === "core" || player.role === "developing"
          ? "low"
          : player.role === "transition" || player.role === "depth" || isOverstocked
            ? "high"
            : "medium";
      return {
        playerId: player.playerId,
        estimatedMarketValue: estimate?.estimatedValue.expected ?? null,
        squadRole: player.role,
        strategicImportance: strategicImportance(player.role, config),
        liquidityPotential,
        confidence: estimate?.confidence ?? "low",
        isTheoretical: estimate?.reasons.some(r => r.type === "no_comparable_market_evidence") ?? true
      };
    })
    .sort((left, right) => left.playerId - right.playerId);
}

function strategicImportance(
  role: SquadDepthPlayer["role"],
  config: CapitalAllocationConfig
): number {
  if (role === "core") return 1;
  if (role === "developing") return 0.8;
  if (role === "rotation") return 0.6;
  if (role === "prospect") return config.strongAssetLiquidityImportance;
  if (role === "depth") return 0.25;
  return 0.15;
}

function buildExtendedCapacity(
  investmentCapacity: InvestmentCapacity,
  potentialAssetLiquidity: number | null
): ExtendedInvestmentCapacity {
  return {
    cashBacked: investmentCapacity.maximumRecommended,
    potentialAssetLiquidity,
    theoreticalMaximum:
      investmentCapacity.maximumRecommended !== null && potentialAssetLiquidity !== null
        ? investmentCapacity.maximumRecommended + potentialAssetLiquidity
        : null
  };
}

function buildAllocationReasons(
  position: ClubFinancialPosition,
  reserve: FinancialReserve,
  allocations: readonly CapitalAllocationItem[],
  gaps: readonly StrategicFundingGap[],
  potentialAssetLiquidity: number | null
): CapitalAllocationReason[] {
  const reasons: CapitalAllocationReason[] = [];
  if (
    position.metrics.payrollCoverageWeeks !== null &&
    position.metrics.payrollCoverageWeeks >= FINANCIAL_SAFETY_CONFIG.strongPayrollCoverageWeeks
  )
    reasons.push({ type: "strong_cash_buffer" });
  if (reserve.minimumCashReserve !== null)
    reasons.push({ type: "reserve_protected", amount: reserve.minimumCashReserve });
  for (const allocation of allocations.filter((item) => item.coverage === "fully_funded"))
    reasons.push({ type: "priority_need_fully_funded", needId: allocation.strategicNeedId });
  for (const gap of gaps)
    reasons.push({ type: "priority_need_underfunded", needId: gap.strategicNeedId, gap: gap.gap });
  if (potentialAssetLiquidity !== null && potentialAssetLiquidity > 0)
    reasons.push({ type: "potential_asset_liquidity_available", amount: potentialAssetLiquidity });
  return reasons;
}

function deriveCapitalAllocationStatus(
  position: ClubFinancialPosition,
  needs: readonly StrategicCapitalNeed[],
  result: { gaps: readonly StrategicFundingGap[]; totalAllocated: number },
  capacity: InvestmentCapacity
): CapitalAllocationStatus {
  if (position.status === "unknown" || capacity.conservative === null) return "unknown";
  const nearTerm = needs.filter(
    (need) =>
      need.horizon !== "medium_term" &&
      need.type === "external_recruitment" &&
      need.estimatedCapitalRequirement !== null
  );
  const nearTermExpected = sum(
    nearTerm
      .map((need) => need.estimatedCapitalRequirement?.expected ?? null)
      .filter(isFiniteNumber)
  );
  const nearTermGaps = result.gaps.filter((gap) =>
    nearTerm.some((need) => need.id === gap.strategicNeedId)
  );
  if (
    nearTerm.some((need) => need.priority === "critical") &&
    nearTermGaps.some((gap) => gap.severity === "critical")
  )
    return "insufficient";
  if (nearTermExpected === 0) return position.status === "strong" ? "ample" : "sufficient";
  if (nearTermGaps.length > 0 && result.totalAllocated === 0) return "insufficient";
  if (nearTermGaps.length > 0 || nearTermExpected > capacity.conservative) return "tight";
  if (capacity.conservative - nearTermExpected <= capacity.conservative * 0.25) return "tight";
  return position.status === "strong" ? "ample" : "sufficient";
}

function compareNeeds(left: StrategicCapitalNeed, right: StrategicCapitalNeed): number {
  return (
    priorityRank(right.priority) - priorityRank(left.priority) ||
    horizonRank(right.horizon) - horizonRank(left.horizon) ||
    typeRank(left.type) - typeRank(right.type) ||
    left.id.localeCompare(right.id)
  );
}

function coverageForAllocation(allocated: number, expected: number): CapitalFundingCoverage {
  if (allocated >= expected) return "fully_funded";
  if (allocated > 0) return "partially_funded";
  return "unfunded";
}

function toCapitalTiming(horizon: SquadPlanningHorizon): CapitalTiming {
  if (horizon === "current") return "now";
  if (horizon === "next_season") return "next_season";
  return "medium_term";
}

function priorityRank(priority: SquadPlanningRecommendationPriority): number {
  return { critical: 4, high: 3, medium: 2, low: 1 }[priority];
}

function horizonRank(horizon: SquadPlanningHorizon): number {
  return { current: 3, next_season: 2, medium_term: 1 }[horizon];
}

function typeRank(type: StrategicCapitalNeed["type"]): number {
  return type === "external_recruitment" ? 0 : 1;
}

function combineConfidence(...values: Confidence[]): Confidence {
  if (values.length === 0 || values.some((value) => value === "low")) return "low";
  if (values.every((value) => value === "high")) return "high";
  return "medium";
}

function finiteNonNegative(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function sum(values: readonly (number | null)[]): number {
  return values.reduce<number>(
    (total, value) => total + (value !== null && Number.isFinite(value) ? value : 0),
    0
  );
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
