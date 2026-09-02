import type { Confidence } from "../types.js";
import type { DevelopmentProfile } from "../playerDevelopment/index.js";
import type { PlayerMarketValueProjection } from "../playerMarketValue/index.js";
import type {
  ProfileDepthAssessment,
  ProfileDepthStatus,
  SquadDepthPlayer,
  SquadPlanningHorizon,
  SquadPlanningRecommendationPriority
} from "../squadPlanning/index.js";
import {
  calculateFinancialReserve,
  calculateInvestmentCapacity,
  calculateSpendableCash,
  simulateFinancialPositionAfterCashChange
} from "./capital-allocation.js";
import type {
  CapitalAllocationContext,
  CapitalAllocationItem,
  CapitalAllocationPlan,
  StrategicFundingGap
} from "./capital-types.js";
import type { ClubFinancialAssessment } from "./types.js";
import type {
  CapitalDeploymentAssessment,
  DevelopmentResourceCost,
  FinancialRecommendationImpact,
  FinancialStrategyConfig,
  FinancialStrategyConflict,
  FinancialStrategyContext,
  FinancialStrategyPlan,
  FinancialStrategyReason,
  FinancialStrategyRecommendation,
  FinancialStrategyRisk,
  LiquidityScenario,
  MonetizationCandidateAssessment,
  MonetizationCandidateReason,
  MonetizationTimingAssessment,
  SquadImpactAssessment,
  StrategicAssetProtection
} from "./strategy-types.js";

export const FINANCIAL_STRATEGY_RECOMMENDATION_CONFIG: FinancialStrategyConfig = {
  shortTermTrainingHorizonWeeks: 8,
  developBeforeMonetizingValueGainPerWeek: 50_000,
  monetizationScoreThreshold: 0.62,
  highFutureContributionThreshold: 0.7,
  highMarketValuePercentile: 0.75,
  strongNeedDepthStatuses: ["critical", "thin"],
  criticalProtectionRoles: ["core", "developing"],
  defaultRecommendationConfidence: "medium"
};

export function buildFinancialStrategyRecommendations(
  context: FinancialStrategyContext,
  config: FinancialStrategyConfig = FINANCIAL_STRATEGY_RECOMMENDATION_CONFIG
): FinancialStrategyPlan {
  const candidates = assessMonetizationCandidates(context, config);
  const scenarios = candidates
    .filter((candidate) => candidate.monetizationScore !== null)
    .map((candidate) => buildLiquidityScenario(context, [candidate.playerId]));
  const recommendations: FinancialStrategyRecommendation[] = [];
  const deploymentAssessments = buildDeploymentAssessments(context);

  addFundingRecommendations(context, recommendations);
  addCashSafetyRecommendation(context, recommendations);
  addInvestmentRecommendation(context, recommendations);
  addLiquidityRecommendations(context, candidates, scenarios, recommendations, config);
  addAssetRecommendations(context, candidates, recommendations, config);

  if (recommendations.length === 0) {
    if (shouldMonitor(context, candidates)) {
      recommendations.push({
        id: "financial:monitor",
        type: "monitor",
        priority: "low",
        horizon: "medium_term",
        confidence: combineConfidence(
          context.financialAssessment.confidence,
          context.allocation.confidence
        ),
        reasons: buildMonitorReasons(context),
        risks: buildMonitorRisks(context)
      });
    } else {
      recommendations.push({
        id: "financial:maintain-position",
        type: "maintain_position",
        priority: "low",
        horizon: "medium_term",
        confidence: combineConfidence(
          context.financialAssessment.confidence,
          context.allocation.confidence
        ),
        reasons: [],
        risks: []
      });
    }
  }

  const conflicts = detectConflicts(recommendations, context, candidates, config);
  const rankedRecommendations = recommendations.sort(compareRecommendations);
  const protectedAssetCount = candidates.filter(
    (candidate) =>
      candidate.strategicProtection === "critical" || candidate.strategicProtection === "high"
  ).length;
  const preserveCash = rankedRecommendations.some(
    (recommendation) => recommendation.type === "preserve_cash"
  );
  const confidence = combineConfidence(
    context.financialAssessment.confidence,
    context.allocation.confidence,
    ...rankedRecommendations.map((recommendation) => recommendation.confidence)
  );

  return {
    recommendations: rankedRecommendations,
    monetizationCandidates: candidates,
    conflicts,
    liquidityScenarios: scenarios,
    deploymentAssessments,
    summary: {
      preserveCash,
      investableCapital: context.allocation.investmentCapacity.conservative ?? 0,
      strategicFundingGap: sum(
        context.allocation.fundingGaps
          .filter(
            (gap) =>
              (gap.severity === "critical" || gap.severity === "high") &&
              isNearTermGap(context, gap)
          )
          .map((gap) => gap.gap)
      ),
      monetizationPotential: context.allocation.potentialAssetLiquidity,
      protectedAssetCount
    },
    confidence
  };
}

export function assessMonetizationCandidates(
  context: CapitalAllocationContext,
  config: FinancialStrategyConfig = FINANCIAL_STRATEGY_RECOMMENDATION_CONFIG
): MonetizationCandidateAssessment[] {
  const players = context.squadPlayers ?? [];
  const marketValues = new Map(
    (context.playerMarketValues ?? []).map((estimate) => [estimate.playerId, estimate])
  );
  const profileValues = (context.playerMarketValues ?? [])
    .map((estimate) => estimate.estimatedValue.expected)
    .filter(isFiniteNumber)
    .sort((left, right) => left - right);
  const maxMarketValue = profileValues.at(-1) ?? null;

  return players
    .map((player) => {
      const estimate = marketValues.get(player.playerId);
      const projection = findProjection(context, player.playerId, player);
      const profileAssessment = findProfileAssessment(context, player.profile);
      const profileStatus = profileAssessment?.status ?? null;
      const successorCoverage = profileAssessment?.succession.coverageStatus ?? null;
      const marketValue =
        estimate?.estimatedValue.expected ?? player.marketValue?.calibratedValue.expected ?? null;
      const timing = assessMonetizationTiming(context, player, marketValue, projection, config);
      const reasons: MonetizationCandidateReason[] = [];
      if (
        marketValue !== null &&
        maxMarketValue !== null &&
        marketValue >= maxMarketValue * config.highMarketValuePercentile
      )
        reasons.push({ type: "high_market_value" });
      if (profileStatus === "overstocked") reasons.push({ type: "profile_overstocked" });
      if (player.role === "depth" || player.role === "transition")
        reasons.push({ type: "low_strategic_importance" });
      if (successorCoverage === "covered") reasons.push({ type: "successor_covered" });
      if (timing.additionalValue !== null && timing.additionalValue <= 0)
        reasons.push({ type: "limited_development_upside" });
      if (player.role === "core") reasons.push({ type: "core_asset" });
      if (successorCoverage === "missing") reasons.push({ type: "missing_successor" });
      if (
        player.futureContributionScore !== null &&
        player.futureContributionScore >= config.highFutureContributionThreshold
      )
        reasons.push({ type: "high_future_contribution" });
      if (profileStatus !== null && config.strongNeedDepthStatuses.includes(profileStatus))
        reasons.push({ type: "strong_profile_need" });

      const strategicProtection = classifyStrategicProtection(player, profileAssessment, config);
      const monetizationScore = calculateMonetizationScore({
        player,
        marketValue,
        maxMarketValue,
        profileStatus,
        successorCoverage,
        timing,
        config
      });
      return {
        playerId: player.playerId,
        profile: player.profile,
        marketValue,
        squadRole: player.role,
        profileStatus,
        successorCoverage,
        currentContribution: player.currentContributionScore,
        futureContribution: player.futureContributionScore,
        trainingValueEfficiency: projection?.roi.averageValueGainPerWeek ?? null,
        projectedPeakValue: projection?.peak?.value ?? null,
        monetizationScore,
        strategicProtection,
        timing,
        isTheoretical: estimate?.reasons.some(r => r.type === "no_comparable_market_evidence") ?? true,
        confidence: combineConfidence(
          estimate?.confidence ?? "low",
          projection?.confidence ?? "low",
          profileAssessment?.confidence ?? "low"
        ),
        reasons
      };
    })
    .sort(
      (left, right) =>
        (right.monetizationScore ?? -1) - (left.monetizationScore ?? -1) ||
        left.playerId - right.playerId
    );
}

export function assessMonetizationTiming(
  context: CapitalAllocationContext,
  player: SquadDepthPlayer,
  currentMarketValue: number | null,
  projection: PlayerMarketValueProjection | null,
  config: FinancialStrategyConfig = FINANCIAL_STRATEGY_RECOMMENDATION_CONFIG
): MonetizationTimingAssessment {
  const resourceCost = developmentResourceCost(context, player);
  if (!projection || currentMarketValue === null) {
    return {
      playerId: player.playerId,
      currentValue: currentMarketValue,
      shortTermPeakValue: null,
      weeksToShortTermPeak: null,
      additionalValue: null,
      valueGainPerWeek: null,
      resourceCost,
      recommendation: "unknown"
    };
  }
  const points = projection.points
    .map((point) => ({
      value: point.marketValue?.expected ?? null,
      weeks: point.cumulativeTrainingWeeks
    }))
    .filter(
      (point) =>
        point.value !== null &&
        point.weeks !== null &&
        point.weeks >= 0 &&
        point.weeks <= config.shortTermTrainingHorizonWeeks
    );
  const peak = points.sort((left, right) => (right.value ?? 0) - (left.value ?? 0))[0] ?? null;
  const shortTermPeakValue = peak?.value ?? null;
  const weeksToShortTermPeak = peak?.weeks ?? null;
  const additionalValue =
    shortTermPeakValue === null ? null : shortTermPeakValue - currentMarketValue;
  const valueGainPerWeek =
    additionalValue !== null && weeksToShortTermPeak !== null && weeksToShortTermPeak > 0
      ? additionalValue / weeksToShortTermPeak
      : projection.roi.averageValueGainPerWeek;
  const strongGrowth =
    valueGainPerWeek !== null && valueGainPerWeek >= config.developBeforeMonetizingValueGainPerWeek;
  const recommendation =
    shortTermPeakValue === null || additionalValue === null
      ? "unknown"
      : strongGrowth && !resourceCost.competesWithHigherPriorityDevelopment
        ? "develop_then_monetize"
        : resourceCost.competesWithHigherPriorityDevelopment
          ? "hold_asset"
          : additionalValue <= 0
            ? "monetize_now"
            : "hold_asset";
  return {
    playerId: player.playerId,
    currentValue: currentMarketValue,
    shortTermPeakValue,
    weeksToShortTermPeak,
    additionalValue,
    valueGainPerWeek,
    resourceCost,
    recommendation
  };
}

export function buildLiquidityScenario(
  context: FinancialStrategyContext,
  playerIds: readonly number[]
): LiquidityScenario {
  const ids = [...new Set(playerIds)].sort((left, right) => left - right);
  const marketValues = new Map(
    (context.playerMarketValues ?? []).map((estimate) => [
      estimate.playerId,
      estimate.estimatedValue.expected
    ])
  );
  const estimatedGrossProceeds = sum(ids.map((playerId) => marketValues.get(playerId) ?? null));
  const financialAssessment = context.financialAssessment;
  const postPosition = simulateFinancialPositionAfterCashChange(
    financialAssessment,
    estimatedGrossProceeds
  );
  const reserve = calculateFinancialReserve(postPosition);
  const capacity = calculateInvestmentCapacity(
    postPosition,
    calculateSpendableCash(postPosition.cash, reserve)
  );
  return {
    playerIdsToMonetize: ids,
    estimatedGrossProceeds,
    resultingCash: postPosition.cash,
    resultingInvestmentCapacity: capacity.maximumRecommended,
    resultingSquadImpact: simulateSquadImpact(context, ids),
    financialStatus: postPosition.status
  };
}

export function simulateSquadImpact(
  context: CapitalAllocationContext,
  playerIds: readonly number[]
): SquadImpactAssessment {
  const ids = new Set(playerIds);
  const players = (context.squadPlayers ?? []).filter((player) => ids.has(player.playerId));
  const affectedProfiles = [
    ...new Set(players.map((player) => player.profile).filter(isDevelopmentProfile))
  ].sort();
  const newDepthStatuses: Partial<Record<DevelopmentProfile, ProfileDepthStatus>> = {};
  let successionRisksCreated = 0;
  let corePlayersRemoved = 0;
  for (const profile of affectedProfiles) {
    const assessment = findProfileAssessment(context, profile);
    if (!assessment) continue;
    const removed = players.filter((player) => player.profile === profile).length;
    const nextCurrent = Math.max(0, assessment.current.availablePlayers - removed);
    newDepthStatuses[profile] =
      nextCurrent < assessment.requirement.minimum
        ? "critical"
        : nextCurrent < assessment.requirement.ideal
          ? "thin"
          : assessment.status;
    if (
      assessment.succession.coverageStatus === "missing" ||
      assessment.succession.coverageStatus === "at_risk"
    )
      successionRisksCreated += 1;
  }
  corePlayersRemoved = players.filter((player) => player.role === "core").length;
  const severity =
    corePlayersRemoved > 0 ||
    successionRisksCreated > 0 ||
    Object.values(newDepthStatuses).some((status) => status === "critical")
      ? "high"
      : affectedProfiles.length > 0
        ? "medium"
        : "low";
  return {
    affectedProfiles,
    newDepthStatuses,
    successionRisksCreated,
    corePlayersRemoved,
    severity
  };
}

function addFundingRecommendations(
  context: FinancialStrategyContext,
  recommendations: FinancialStrategyRecommendation[]
): void {
  for (const need of context.allocation.strategicNeeds) {
    const allocation = findAllocation(context.allocation, need.id);
    if (need.type === "development_support" && need.priority !== "low") {
      recommendations.push({
        id: `strategy:fund:${need.id}`,
        type: "fund_priority_need",
        priority: need.priority,
        horizon: need.horizon,
        profile: need.profile,
        strategicNeedId: need.id,
        financialImpact: {
          estimatedCashCommitment: null,
          postActionCash: context.financialAssessment.position.cash,
          postActionFinancialStatus: context.financialAssessment.position.status
        },
        confidence: need.confidence,
        reasons: [{ type: "priority_squad_need", profile: need.profile }],
        risks: []
      });
      continue;
    }
    if (need.type !== "external_recruitment" || need.estimatedCapitalRequirement === null) continue;
    if (allocation?.coverage === "fully_funded") {
      recommendations.push({
        id: `strategy:fund:${need.id}`,
        type: "fund_priority_need",
        priority: need.priority,
        horizon: need.horizon,
        profile: need.profile,
        strategicNeedId: need.id,
        financialImpact: buildCommitmentImpact(
          context.financialAssessment,
          need.estimatedCapitalRequirement.expected
        ),
        confidence: need.confidence,
        reasons: [
          { type: "priority_squad_need", profile: need.profile },
          { type: "need_fully_fundable" }
        ],
        risks: riskForCommitment(
          context.financialAssessment,
          need.estimatedCapitalRequirement.expected
        )
      });
    } else {
      recommendations.push({
        id: `strategy:delay:${need.id}`,
        type: "delay_recruitment",
        priority: need.priority,
        horizon: need.horizon,
        profile: need.profile,
        strategicNeedId: need.id,
        financialImpact: {
          estimatedCashCommitment: null,
          postActionCash: context.financialAssessment.position.cash,
          postActionFinancialStatus: context.financialAssessment.position.status
        },
        confidence: need.confidence,
        reasons: [
          { type: "priority_squad_need", profile: need.profile },
          { type: "need_not_safely_fundable" },
          {
            type: "funding_gap",
            amount:
              findGap(context.allocation, need.id)?.gap ?? need.estimatedCapitalRequirement.expected
          }
        ],
        risks: need.horizon === "medium_term" ? [{ type: "long_horizon_uncertainty" }] : []
      });
    }
  }
}

function addCashSafetyRecommendation(
  context: FinancialStrategyContext,
  recommendations: FinancialStrategyRecommendation[]
): void {
  const position = context.financialAssessment.position;
  const criticalGap = context.allocation.fundingGaps.some(
    (gap) => gap.severity === "critical" && isNearTermGap(context, gap)
  );
  const shouldPreserve =
    position.status === "strained" ||
    position.status === "watch" ||
    context.allocation.investmentCapacity.maximumRecommended === 0 ||
    criticalGap;
  if (!shouldPreserve) return;
  const priority: SquadPlanningRecommendationPriority =
    position.status === "strained" || criticalGap ? "critical" : "high";
  const reasons: FinancialStrategyReason[] =
    position.status === "strained" || position.status === "watch"
      ? [{ type: "financial_position_strained" }]
      : [{ type: "need_not_safely_fundable" }];
  if (criticalGap)
    reasons.push({
      type: "funding_gap",
      amount: sum(
        context.allocation.fundingGaps
          .filter((gap) => gap.severity === "critical")
          .map((gap) => gap.gap)
      )
    });
  recommendations.push({
    id: "strategy:preserve-cash",
    type: "preserve_cash",
    priority,
    horizon: "current",
    financialImpact: {
      estimatedCashCommitment: 0,
      postActionCash: position.cash,
      postActionFinancialStatus: position.status
    },
    confidence: combineConfidence(
      context.financialAssessment.confidence,
      context.allocation.confidence
    ),
    reasons,
    risks: [{ type: "liquidity_reduction" }]
  });
}

function addInvestmentRecommendation(
  context: FinancialStrategyContext,
  recommendations: FinancialStrategyRecommendation[]
): void {
  const hasDevelopmentNeed = context.allocation.strategicNeeds.some(
    (need) => need.type === "development_support" && need.priority !== "low"
  );
  const hasFundedNeed = recommendations.some(
    (recommendation) => recommendation.type === "fund_priority_need"
  );
  const capacity = context.allocation.investmentCapacity.conservative ?? 0;
  if (
    (context.financialAssessment.position.status !== "strong" &&
      context.financialAssessment.position.status !== "healthy") ||
    capacity <= 0 ||
    (!hasDevelopmentNeed && !hasFundedNeed)
  )
    return;
  recommendations.push({
    id: "strategy:invest-in-squad",
    type: "invest_in_squad",
    priority: hasFundedNeed ? "high" : "medium",
    horizon: "next_season",
    financialImpact: { estimatedCashCommitment: capacity, opportunityCost: capacity },
    confidence: combineConfidence(
      context.financialAssessment.confidence,
      context.allocation.confidence
    ),
    reasons: [{ type: "ample_investment_capacity" }],
    risks: []
  });
}

function addLiquidityRecommendations(
  context: FinancialStrategyContext,
  candidates: readonly MonetizationCandidateAssessment[],
  scenarios: readonly LiquidityScenario[],
  recommendations: FinancialStrategyRecommendation[],
  config: FinancialStrategyConfig
): void {
  const gaps = context.allocation.fundingGaps.filter(
    (gap) => (gap.severity === "critical" || gap.severity === "high") && isNearTermGap(context, gap)
  );
  const liquidCandidates = candidates.filter(
    (candidate) =>
      (candidate.monetizationScore ?? 0) >= config.monetizationScoreThreshold &&
      candidate.strategicProtection !== "critical"
  );
  if (gaps.length === 0 || liquidCandidates.length === 0) return;
  const playerIds = liquidCandidates
    .map((candidate) => candidate.playerId)
    .sort((left, right) => left - right);
  const scenario =
    scenarios.find((item) => sameIds(item.playerIdsToMonetize, playerIds)) ??
    buildLiquidityScenario(context, playerIds);
  recommendations.push({
    id: "strategy:build-liquidity",
    type: "build_liquidity",
    priority: gaps.some((gap) => gap.severity === "critical") ? "high" : "medium",
    horizon: "next_season",
    playerIds,
    financialImpact: {
      estimatedCashRelease: scenario.estimatedGrossProceeds,
      postActionCash: scenario.resultingCash,
      postActionFinancialStatus: scenario.financialStatus
    },
    confidence: combineConfidence(
      ...liquidCandidates.map((candidate) => candidate.confidence),
      context.allocation.confidence
    ),
    reasons: [{ type: "funding_gap", amount: sum(gaps.map((gap) => gap.gap)) }],
    risks: scenario.resultingSquadImpact.severity === "high" ? [{ type: "squad_depth_damage" }] : []
  });
}

function addAssetRecommendations(
  context: FinancialStrategyContext,
  candidates: readonly MonetizationCandidateAssessment[],
  recommendations: FinancialStrategyRecommendation[],
  config: FinancialStrategyConfig
): void {
  for (const candidate of candidates) {
    const marketReason = candidate.reasons.some((reason) => reason.type === "high_market_value");
    if (candidate.strategicProtection === "critical" || candidate.strategicProtection === "high") {
      if (!marketReason) continue;
      recommendations.push({
        id: `strategy:protect:${candidate.playerId}`,
        type: "protect_strategic_asset",
        priority: candidate.strategicProtection === "critical" ? "critical" : "high",
        horizon: "current",
        playerIds: [candidate.playerId],
        financialImpact: { estimatedCashRelease: null, opportunityCost: candidate.marketValue },
        confidence: candidate.confidence,
        reasons: candidate.reasons
          .filter((reason) => reason.type === "core_asset" || reason.type === "missing_successor")
          .map((reason) => toStrategyReason(reason, candidate)),
        risks: [{ type: "squad_depth_damage" }, { type: "succession_risk_created" }]
      });
      continue;
    }
    if ((candidate.monetizationScore ?? 0) < config.monetizationScoreThreshold) continue;
    if (candidate.timing.recommendation === "develop_then_monetize") {
      const developRecommendation = buildDevelopBeforeMonetizingRecommendation(candidate);
      recommendations.push(developRecommendation);
      if ((candidate.monetizationScore ?? 0) >= config.monetizationScoreThreshold + 0.15) {
        recommendations.push(buildMonetizeRecommendation(context, candidate));
      }
      continue;
    }
    if (candidate.timing.recommendation === "monetize_now")
      recommendations.push(buildMonetizeRecommendation(context, candidate));
  }
}

function buildMonetizeRecommendation(
  context: FinancialStrategyContext,
  candidate: MonetizationCandidateAssessment
): FinancialStrategyRecommendation {
  const scenario = buildLiquidityScenario(context, [candidate.playerId]);
  return {
    id: `strategy:monetize:${candidate.playerId}`,
    type: "monetize_surplus_asset",
    priority: candidate.reasons.some((reason) => reason.type === "high_market_value")
      ? "high"
      : "medium",
    horizon: "current",
    playerIds: [candidate.playerId],
    financialImpact: {
      estimatedCashRelease: candidate.marketValue,
      postActionCash: scenario.resultingCash,
      postActionFinancialStatus: scenario.financialStatus,
      opportunityCost: candidate.futureContribution
    },
    confidence: candidate.confidence,
    reasons: candidate.reasons
      .filter(
        (reason) =>
          reason.type === "high_market_value" ||
          reason.type === "profile_overstocked" ||
          reason.type === "low_strategic_importance"
      )
      .map((reason) => toStrategyReason(reason, candidate)),
    risks:
      candidate.profileStatus === "critical" || candidate.successorCoverage === "missing"
        ? [{ type: "squad_depth_damage" }, { type: "succession_risk_created" }]
        : []
  };
}

function buildDevelopBeforeMonetizingRecommendation(
  candidate: MonetizationCandidateAssessment
): FinancialStrategyRecommendation {
  const reasons: FinancialStrategyReason[] = [];
  if (candidate.timing.additionalValue !== null && candidate.timing.additionalValue > 0)
    reasons.push({ type: "strong_short_term_value_growth", playerId: candidate.playerId });
  if (candidate.timing.resourceCost.competesWithHigherPriorityDevelopment)
    reasons.push({ type: "advanced_resource_conflict", playerId: candidate.playerId });
  return {
    id: `strategy:develop:${candidate.playerId}`,
    type: "develop_before_monetizing",
    priority: "medium",
    horizon: "next_season",
    playerIds: [candidate.playerId],
    financialImpact: {
      estimatedCashRelease: candidate.timing.shortTermPeakValue,
      opportunityCost: candidate.timing.additionalValue
    },
    confidence: candidate.confidence,
    reasons,
    risks: candidate.timing.resourceCost.competesWithHigherPriorityDevelopment
      ? [{ type: "training_resource_opportunity_cost" }]
      : []
  };
}

function detectConflicts(
  recommendations: readonly FinancialStrategyRecommendation[],
  context: FinancialStrategyContext,
  candidates: readonly MonetizationCandidateAssessment[],
  config: FinancialStrategyConfig
): FinancialStrategyConflict[] {
  const conflicts: FinancialStrategyConflict[] = [];
  for (const candidate of candidates) {
    const monetize = recommendations.find(
      (recommendation) => recommendation.id === `strategy:monetize:${candidate.playerId}`
    );
    const develop = recommendations.find(
      (recommendation) => recommendation.id === `strategy:develop:${candidate.playerId}`
    );
    if (monetize && develop)
      conflicts.push({
        playerId: candidate.playerId,
        recommendationIds: [monetize.id, develop.id],
        type: "monetize_vs_develop"
      });
    if (
      monetize &&
      candidate.profileStatus !== null &&
      config.strongNeedDepthStatuses.includes(candidate.profileStatus)
    )
      conflicts.push({
        playerId: candidate.playerId,
        recommendationIds: [monetize.id],
        type: "monetize_vs_squad_need"
      });
  }
  const preserve = recommendations.find(
    (recommendation) => recommendation.type === "preserve_cash"
  );
  const investments = recommendations.filter(
    (recommendation) =>
      recommendation.type === "fund_priority_need" || recommendation.type === "invest_in_squad"
  );
  if (preserve && investments.length > 0)
    conflicts.push({
      recommendationIds: [preserve.id, ...investments.map((recommendation) => recommendation.id)],
      type: "investment_vs_cash_preservation"
    });
  return conflicts;
}

function buildCommitmentImpact(
  financialAssessment: ClubFinancialAssessment,
  amount: number
): FinancialRecommendationImpact {
  const simulated = simulateFinancialPositionAfterCashChange(financialAssessment, -amount);
  return {
    estimatedCashCommitment: amount,
    postActionCash: simulated.cash,
    postActionFinancialStatus: simulated.status,
    opportunityCost: amount
  };
}

function riskForCommitment(
  financialAssessment: ClubFinancialAssessment,
  amount: number
): FinancialStrategyRisk[] {
  const simulated = simulateFinancialPositionAfterCashChange(financialAssessment, -amount);
  return simulated.status === "watch" || simulated.status === "strained"
    ? [{ type: "liquidity_reduction" }]
    : [];
}

function buildDeploymentAssessments(
  context: FinancialStrategyContext
): CapitalDeploymentAssessment[] {
  return context.allocation.strategicNeeds.map((need) => {
    const profile = findProfileAssessment(context, need.profile);
    const sportingImpact =
      profile?.status === "critical" ? 1 : profile?.status === "thin" ? 0.7 : profile ? 0.3 : null;
    const requiredCapital = need.estimatedCapitalRequirement?.expected ?? null;
    return {
      needId: need.id,
      requiredCapital,
      expectedSportingImpact: sportingImpact,
      expectedAssetValueImpact: null,
      efficiencyScore:
        requiredCapital !== null && sportingImpact !== null && requiredCapital > 0
          ? sportingImpact / requiredCapital
          : null
    };
  });
}

function buildMonitorReasons(context: FinancialStrategyContext): FinancialStrategyReason[] {
  const reasons: FinancialStrategyReason[] = [];
  if (
    context.financialAssessment.position.status === "watch" ||
    context.financialAssessment.position.status === "strained"
  )
    reasons.push({ type: "financial_position_strained" });
  if (context.allocation.fundingGaps.length > 0)
    reasons.push({
      type: "funding_gap",
      amount: sum(context.allocation.fundingGaps.map((gap) => gap.gap))
    });
  return reasons;
}

function buildMonitorRisks(context: FinancialStrategyContext): FinancialStrategyRisk[] {
  return context.allocation.confidence === "low" || context.financialAssessment.confidence === "low"
    ? [{ type: "market_value_uncertain" }]
    : [];
}

function shouldMonitor(
  context: FinancialStrategyContext,
  candidates: readonly MonetizationCandidateAssessment[]
): boolean {
  return (
    context.financialAssessment.confidence === "low" ||
    context.allocation.confidence === "low" ||
    context.allocation.fundingGaps.length > 0 ||
    candidates.some((candidate) => candidate.timing.recommendation === "unknown")
  );
}

function findAllocation(plan: CapitalAllocationPlan, needId: string): CapitalAllocationItem | null {
  return plan.allocation.find((item) => item.strategicNeedId === needId) ?? null;
}

function findGap(plan: CapitalAllocationPlan, needId: string): StrategicFundingGap | null {
  return plan.fundingGaps.find((gap) => gap.strategicNeedId === needId) ?? null;
}

function isNearTermGap(context: FinancialStrategyContext, gap: StrategicFundingGap): boolean {
  return context.allocation.strategicNeeds.some(
    (need) => need.id === gap.strategicNeedId && need.horizon !== "medium_term"
  );
}

function findProfileAssessment(
  context: CapitalAllocationContext,
  profile: DevelopmentProfile | null | undefined
): ProfileDepthAssessment | null {
  return profile
    ? (context.depthAnalysis.profiles.find((assessment) => assessment.profile === profile) ?? null)
    : null;
}

function findProjection(
  context: CapitalAllocationContext,
  playerId: number,
  player?: SquadDepthPlayer
): NonNullable<SquadDepthPlayer["marketProjection"]> | null {
  return (
    context.marketProjections?.find((projection) => projection.playerId === playerId) ??
    player?.marketProjection ??
    null
  );
}

function developmentResourceCost(
  context: CapitalAllocationContext,
  player: SquadDepthPlayer
): DevelopmentResourceCost {
  const explicit = (context as FinancialStrategyContext).advancedResources?.find(
    (resource) => resource.playerId === player.playerId
  );
  const comparison = player.marketTrainingComparison;
  return {
    requiresAdvanced:
      explicit?.requiresAdvanced ?? (comparison?.difference.valueGeneratedByAdvancedSlot ?? 0) > 0,
    projectedAdvancedRank: explicit?.projectedAdvancedRank ?? null,
    competesWithHigherPriorityDevelopment: explicit?.competesWithHigherPriorityDevelopment ?? false
  };
}

function classifyStrategicProtection(
  player: SquadDepthPlayer,
  profile: ProfileDepthAssessment | null,
  config: FinancialStrategyConfig
): StrategicAssetProtection {
  const missingSuccessor = profile?.succession.coverageStatus === "missing";
  const dependency = profile?.dependencyRisk !== null && profile?.dependencyRisk !== undefined;
  if ((player.role === "core" && missingSuccessor) || dependency) return "critical";
  if (
    config.criticalProtectionRoles.includes(player.role) ||
    (player.futureContributionScore !== null &&
      player.futureContributionScore >= config.highFutureContributionThreshold)
  )
    return "high";
  if (player.role === "transition" || player.role === "depth") return "low";
  return "normal";
}

function calculateMonetizationScore(input: {
  player: SquadDepthPlayer;
  marketValue: number | null;
  maxMarketValue: number | null;
  profileStatus: ProfileDepthStatus | null;
  successorCoverage: string | null;
  timing: MonetizationTimingAssessment;
  config: FinancialStrategyConfig;
}): number | null {
  if (
    input.marketValue === null &&
    input.profileStatus === null &&
    input.player.futureContributionScore === null
  )
    return null;
  let score =
    input.marketValue !== null && input.maxMarketValue !== null && input.maxMarketValue > 0
      ? 0.3 * (input.marketValue / input.maxMarketValue)
      : 0;
  if (input.profileStatus === "overstocked") score += 0.28;
  if (input.player.role === "transition" || input.player.role === "depth") score += 0.2;
  if (input.successorCoverage === "covered") score += 0.15;
  if (input.timing.additionalValue !== null && input.timing.additionalValue <= 0) score += 0.08;
  if (input.player.role === "core") score -= 0.35;
  if (input.successorCoverage === "missing") score -= 0.3;
  if (input.profileStatus === "critical" || input.profileStatus === "thin") score -= 0.18;
  if (
    input.player.futureContributionScore !== null &&
    input.player.futureContributionScore >= input.config.highFutureContributionThreshold
  )
    score -= 0.2;
  return Math.min(1, Math.max(0, roundScore(score)));
}

function toStrategyReason(
  reason: MonetizationCandidateReason,
  candidate: MonetizationCandidateAssessment
): FinancialStrategyReason {
  if (reason.type === "high_market_value")
    return { type: "asset_has_high_market_value", playerId: candidate.playerId };
  if (reason.type === "profile_overstocked")
    return { type: "profile_overstocked", profile: profileForCandidate(candidate) };
  if (reason.type === "low_strategic_importance")
    return { type: "asset_has_low_strategic_importance", playerId: candidate.playerId };
  if (reason.type === "missing_successor")
    return { type: "no_ready_successor", playerId: candidate.playerId };
  if (reason.type === "strong_profile_need")
    return { type: "priority_squad_need", profile: profileForCandidate(candidate) };
  return { type: "ample_investment_capacity" };
}

function profileForCandidate(candidate: MonetizationCandidateAssessment): DevelopmentProfile {
  return candidate.profile ?? "goalkeeper";
}

function compareRecommendations(
  left: FinancialStrategyRecommendation,
  right: FinancialStrategyRecommendation
): number {
  return (
    priorityRank(right.priority) - priorityRank(left.priority) ||
    horizonRank(left.horizon) - horizonRank(right.horizon) ||
    recommendationTypeRank(left.type) - recommendationTypeRank(right.type) ||
    left.id.localeCompare(right.id)
  );
}

function priorityRank(priority: SquadPlanningRecommendationPriority): number {
  return { critical: 4, high: 3, medium: 2, low: 1 }[priority];
}

function horizonRank(horizon: SquadPlanningHorizon): number {
  return { current: 0, next_season: 1, medium_term: 2 }[horizon];
}

function recommendationTypeRank(type: FinancialStrategyRecommendation["type"]): number {
  return {
    fund_priority_need: 0,
    preserve_cash: 1,
    protect_strategic_asset: 2,
    build_liquidity: 3,
    delay_recruitment: 4,
    invest_in_squad: 5,
    develop_before_monetizing: 6,
    monetize_surplus_asset: 7,
    monitor: 8,
    maintain_position: 9
  }[type];
}

function combineConfidence(...values: Confidence[]): Confidence {
  if (values.length === 0 || values.some((value) => value === "low")) return "low";
  if (values.every((value) => value === "high")) return "high";
  return "medium";
}

function sameIds(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isDevelopmentProfile(value: DevelopmentProfile | null): value is DevelopmentProfile {
  return value !== null;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function sum(values: readonly (number | null)[]): number {
  return values.reduce<number>((total, value) => total + (isFiniteNumber(value) ? value : 0), 0);
}
