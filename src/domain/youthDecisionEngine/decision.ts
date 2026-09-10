import type { Confidence } from "../types.js";
import type { DevelopmentProfile } from "../playerDevelopment/index.js";
import type {
  CalibratedPlayerMarketValueEstimate,
  PlayerMarketValueEstimate
} from "../playerMarketValue/index.js";
import {
  YOUTH_DECISION_CONFIG,
  type YouthDecision,
  type YouthDecisionConfig,
  type YouthDecisionContext,
  type YouthDecisionPriority,
  type YouthDecisionReason,
  type YouthDecisionRecommendation,
  type YouthDecisionRisk,
  type YouthDecisionScores,
  type YouthDecisionSummary
} from "./decision-types.js";

export function recommendYouthDecision(
  context: YouthDecisionContext,
  config: Partial<YouthDecisionConfig> = {}
): YouthDecisionRecommendation {
  const resolvedConfig = { ...YOUTH_DECISION_CONFIG, ...config };
  const economicEvidence = calculateEconomicEvidence(context, resolvedConfig);
  const baseScores = calculateDecisionScores(context, economicEvidence);
  const resourceEfficiency = calculateResourceEfficiency(
    context,
    baseScores,
    economicEvidence,
    resolvedConfig
  );
  const scores: YouthDecisionScores = { ...baseScores, resourceEfficiency };
  const decision = stabilizeDecision(
    chooseDecision(context, scores, economicEvidence, resolvedConfig),
    context.previousDecision,
    context,
    economicEvidence,
    scores,
    resolvedConfig
  );
  const recommendedProfile = resolveRecommendedProfile(context, decision, resolvedConfig);
  const reasons = buildReasons(
    context,
    scores,
    economicEvidence,
    recommendedProfile,
    resolvedConfig,
    decision
  );
  const risks = buildRisks(context, scores, economicEvidence, resolvedConfig);

  return {
    playerId: context.player.playerId,
    decision,
    priority: calculatePriority(decision, scores, economicEvidence, resolvedConfig),
    sportingConfidence: calculateSportingConfidence(context),
    economicConfidence: calculateEconomicConfidence(economicEvidence),
    scores,
    recommendedProfile,
    alternativeProfile: context.opportunity.reprofileOpportunity?.viable
      ? context.opportunity.reprofileOpportunity.alternativeProfile
      : null,
    reasons,
    risks,
    breakdown: {
      ...scores,
      positiveSignals: reasons.filter(isPositiveReason).length,
      negativeSignals: reasons.filter(isNegativeReason).length + risks.length
    }
  };
}

export function evaluateYouthDecisions(
  contexts: readonly YouthDecisionContext[],
  config: Partial<YouthDecisionConfig> = {}
): YouthDecisionRecommendation[] {
  return contexts.map((context) => recommendYouthDecision(context, config)).sort(compareDecisions);
}

export function summarizeYouthDecisions(
  recommendations: readonly YouthDecisionRecommendation[]
): YouthDecisionSummary {
  const counts: Record<YouthDecision, number> = {
    train: 0,
    keep: 0,
    sell: 0,
    release: 0,
    hold: 0,
    unknown: 0
  };
  for (const recommendation of recommendations) counts[recommendation.decision] += 1;

  return {
    recommendations: [...recommendations],
    counts,
    highPriorityDecisions: recommendations.filter((item) => item.priority === "high").length,
    advancedCandidates: recommendations.filter((item) =>
      item.reasons.some((reason) => reason.type === "advanced_training_candidate")
    ).length
  };
}

export class YouthDecisionRecommendationService {
  recommend(
    context: YouthDecisionContext,
    config: Partial<YouthDecisionConfig> = {}
  ): YouthDecisionRecommendation {
    return recommendYouthDecision(context, config);
  }

  evaluate(
    contexts: readonly YouthDecisionContext[],
    config: Partial<YouthDecisionConfig> = {}
  ): YouthDecisionRecommendation[] {
    return evaluateYouthDecisions(contexts, config);
  }

  summarize(recommendations: readonly YouthDecisionRecommendation[]): YouthDecisionSummary {
    return summarizeYouthDecisions(recommendations);
  }
}

interface EconomicEvidence {
  score: number | null;
  currentValue: number | null;
  projectedValue: number | null;
  peakValue: number | null;
  currentConfidence: Confidence | null;
  projectionConfidence: Confidence | null;
  strongCurrentValue: boolean;
  highValueCreation: boolean;
  highTrainingValueEfficiency: boolean;
}

function calculateDecisionScores(
  context: YouthDecisionContext,
  economicEvidence: EconomicEvidence
): Omit<YouthDecisionScores, "resourceEfficiency"> {
  return {
    prospectQuality: finiteScore(context.prospect.prospectScore),
    clubFit: finiteScore(context.opportunity.clubFitScore),
    developmentOpportunity: finiteScore(context.opportunity.developmentOpportunityScore),
    economicOpportunity: economicEvidence.score
  };
}

function calculateEconomicEvidence(
  context: YouthDecisionContext,
  config: YouthDecisionConfig
): EconomicEvidence {
  const currentValue = currentMarketValue(context.marketValue);
  const projectedValue = context.marketProjection?.completion?.marketValue?.expected ?? null;
  const peakValue = context.marketProjection?.peak?.value ?? null;
  const bestProjectedValue = maxNullable(projectedValue, peakValue);
  const currentConfidence = context.marketValue?.confidence ?? null;
  const projectionConfidence = context.marketProjection?.confidence ?? null;

  if (currentValue === null && bestProjectedValue === null) {
    return {
      score: null,
      currentValue,
      projectedValue,
      peakValue,
      currentConfidence,
      projectionConfidence,
      strongCurrentValue: false,
      highValueCreation: false,
      highTrainingValueEfficiency: false
    };
  }

  const currentAttractiveness = normalizeMarketAmount(currentValue, config.marketValueReference);
  const projectedAttractiveness = normalizeMarketAmount(
    bestProjectedValue,
    config.marketValueReference * 1.5
  );
  const upside =
    currentValue !== null && bestProjectedValue !== null && bestProjectedValue > 0
      ? clamp((bestProjectedValue - currentValue) / bestProjectedValue, 0, 1)
      : null;
  const averageValueGainPerWeek = context.marketProjection?.roi.averageValueGainPerWeek ?? null;
  const efficiencyReference =
    config.marketValueReference / config.maximumTrainingWeeksForEfficiency;
  const trainingValueEfficiency =
    averageValueGainPerWeek !== null && Number.isFinite(averageValueGainPerWeek)
      ? clamp(averageValueGainPerWeek / Math.max(efficiencyReference, 1), 0, 1)
      : null;
  const components = [
    { value: currentAttractiveness, weight: 0.25 },
    { value: projectedAttractiveness, weight: 0.25 },
    { value: upside, weight: 0.3 },
    { value: trainingValueEfficiency, weight: 0.2 }
  ].filter((component): component is { value: number; weight: number } => component.value !== null);

  return {
    score: components.length === 0 ? null : roundScore(weightedAverage(components)),
    currentValue,
    projectedValue,
    peakValue,
    currentConfidence,
    projectionConfidence,
    strongCurrentValue: currentValue !== null && currentValue >= config.marketValueReference,
    highValueCreation: upside !== null && upside >= 0.45 && (trainingValueEfficiency ?? 0) >= 0.45,
    highTrainingValueEfficiency: (trainingValueEfficiency ?? 0) >= 0.65
  };
}

function calculateResourceEfficiency(
  context: YouthDecisionContext,
  scores: Omit<YouthDecisionScores, "resourceEfficiency">,
  evidence: EconomicEvidence,
  config: YouthDecisionConfig
): number | null {
  if (scores.developmentOpportunity === null) return null;
  const benefit =
    (scores.prospectQuality ?? 0) * 0.4 +
    (scores.clubFit ?? 0.5) * 0.25 +
    (scores.economicOpportunity ?? 0.5) * 0.2 +
    scores.developmentOpportunity * 0.15;
  const competition = context.opportunity.resourceCompetitionScore ?? 0.5;
  const advancedBurden =
    context.opportunity.advancedTraining?.opportunity === "likely"
      ? 0.35
      : context.opportunity.advancedTraining?.opportunity === "competitive"
        ? 0.25
        : context.opportunity.advancedTraining?.opportunity === "unlikely"
          ? 0.1
          : 0.2;
  const weeks =
    context.marketProjection?.completion?.estimatedWeeks ??
    context.developmentProjection?.completion.estimatedWeeks ??
    null;
  const pathEfficiency =
    weeks === null || !Number.isFinite(weeks)
      ? 0.5
      : clamp(1 - weeks / config.maximumTrainingWeeksForEfficiency, 0.2, 1);
  const economicFactor = evidence.highTrainingValueEfficiency ? 1.1 : 1;
  return roundScore(
    clamp(
      benefit *
        (1 - competition * 0.45) *
        (1 - advancedBurden * 0.25) *
        (0.6 + pathEfficiency * 0.4) *
        economicFactor,
      0,
      1
    )
  );
}

function chooseDecision(
  context: YouthDecisionContext,
  scores: YouthDecisionScores,
  evidence: EconomicEvidence,
  config: YouthDecisionConfig
): YouthDecision {
  const prospect = scores.prospectQuality;
  const clubFit = scores.clubFit;
  const development = scores.developmentOpportunity;
  const economics = scores.economicOpportunity;
  const resource = scores.resourceEfficiency;
  if (prospect === null || clubFit === null || development === null) return "unknown";
  if (context.prospect.confidence === "low" || context.opportunity.opportunity === "unknown")
    return "unknown";
  if (!hasSufficientTrainingSnapshots(context)) return "hold";

  const sportingTrain =
    prospect >= config.highProspectThreshold &&
    clubFit >= config.strongClubFitThreshold &&
    development >= config.goodDevelopmentOpportunityThreshold;
  const economicTrain =
    prospect >= config.highProspectThreshold &&
    evidence.highValueCreation &&
    resource !== null &&
    resource >= config.strongResourceEfficiencyThreshold;
  if (sportingTrain || economicTrain) return "train";

  const strongMarketExit =
    evidence.strongCurrentValue &&
    economics !== null &&
    economics >= config.strongEconomicOpportunityThreshold &&
    (clubFit <= config.poorClubFitThreshold ||
      development <= config.limitedDevelopmentOpportunityThreshold ||
      (context.opportunity.resourceCompetitionScore ?? 0) >= 0.65);
  if (strongMarketExit) return "sell";

  const lowSport = prospect <= config.lowProspectThreshold;
  const lowDevelopment = development <= config.limitedDevelopmentOpportunityThreshold;
  const poorFit = clubFit <= config.poorClubFitThreshold;
  const lowEconomics = economics !== null && economics <= config.lowEconomicOpportunityThreshold;
  const marketAllowsRelease =
    evidence.currentConfidence !== null &&
    confidenceAtLeast(evidence.currentConfidence, config.releaseRequiresMarketConfidence) &&
    lowEconomics;
  if (lowSport && lowDevelopment && poorFit && marketAllowsRelease) return "release";
  if (
    evidence.strongCurrentValue &&
    evidence.currentConfidence !== null &&
    confidenceAtLeast(evidence.currentConfidence, "medium") &&
    (poorFit || lowDevelopment)
  )
    return "sell";

  if (
    prospect >= config.highProspectThreshold &&
    (clubFit >= config.strongClubFitThreshold || context.opportunity.reprofileOpportunity?.viable)
  )
    return "train";
  if (
    clubFit >= config.goodDevelopmentOpportunityThreshold ||
    development >= config.goodDevelopmentOpportunityThreshold
  ) {
    return "keep";
  }
  if (evidence.strongCurrentValue && economics !== null && economics >= 0.5) return "sell";
  return "unknown";
}

function hasSufficientTrainingSnapshots(context: YouthDecisionContext): boolean {
  const observations = context.prospect.reasons.find(
    (reason): reason is Extract<typeof reason, { type: "training_evidence" }> =>
      reason.type === "training_evidence"
  )?.observationCount;
  return (observations ?? 0) >= 3;
}

function stabilizeDecision(
  decision: YouthDecision,
  previous: YouthDecisionRecommendation | null | undefined,
  context: YouthDecisionContext,
  evidence: EconomicEvidence,
  scores: YouthDecisionScores,
  config: YouthDecisionConfig
): YouthDecision {
  if (!previous || previous.decision === decision) return decision;
  const materialEvidence =
    evidence.currentConfidence === "high" ||
    evidence.projectionConfidence === "high" ||
    (context.prospect.confidence === "high" && context.opportunity.confidence === "high");
  if (materialEvidence) return decision;
  const scoreChanges = Object.keys(scores).map((key) => {
    const current = scores[key as keyof YouthDecisionScores];
    const prior = previous.scores[key as keyof YouthDecisionScores];
    return current === null || prior === null
      ? Number.POSITIVE_INFINITY
      : Math.abs(current - prior);
  });
  if (scoreChanges.every((change) => change <= config.decisionStabilityMargin)) {
    return previous.decision;
  }
  if (previous.decision === "release" || decision === "release") return "unknown";
  if (
    (previous.decision === "train" || decision === "train") &&
    context.prospect.confidence !== "high"
  ) {
    return previous.decision;
  }
  return decision;
}

function resolveRecommendedProfile(
  context: YouthDecisionContext,
  decision: YouthDecision,
  config: YouthDecisionConfig
): DevelopmentProfile | null {
  const current = context.prospect.suggestedProfile;
  const alternative = context.opportunity.reprofileOpportunity;
  if (
    decision === "train" &&
    alternative?.viable &&
    (context.opportunity.clubFitScore ?? 0) < config.strongClubFitThreshold
  ) {
    return alternative.alternativeProfile;
  }
  return current;
}

function buildReasons(
  context: YouthDecisionContext,
  scores: YouthDecisionScores,
  evidence: EconomicEvidence,
  recommendedProfile: DevelopmentProfile | null,
  config: YouthDecisionConfig,
  decision: YouthDecision
): YouthDecisionReason[] {
  const reasons: YouthDecisionReason[] = [];
  if ((scores.prospectQuality ?? 0) >= config.eliteProspectThreshold)
    reasons.push({ type: "elite_prospect" });
  if ((scores.clubFit ?? 0) >= config.strongClubFitThreshold)
    reasons.push({ type: "strong_club_fit" });
  if (context.prospect.suggestedProfile && (context.opportunity.squadNeedScore ?? 0) >= 0.58) {
    reasons.push({ type: "fills_future_squad_need", profile: context.prospect.suggestedProfile });
  }
  if ((context.opportunity.succession?.score ?? 0) >= 0.65)
    reasons.push({ type: "succession_candidate" });
  if ((scores.developmentOpportunity ?? 0) >= 0.65)
    reasons.push({ type: "high_development_upside" });
  if (evidence.highValueCreation) reasons.push({ type: "high_development_value_creation" });
  if (evidence.highTrainingValueEfficiency)
    reasons.push({ type: "high_training_value_efficiency" });
  if (["likely", "competitive"].includes(context.opportunity.advancedTraining?.opportunity ?? "")) {
    reasons.push({ type: "advanced_training_candidate" });
  }
  if (context.opportunity.reasons.some((reason) => reason.type === "formation_training_viable")) {
    reasons.push({ type: "formation_development_viable" });
  }
  if (context.opportunity.reasons.some((reason) => reason.type === "profile_overstocked")) {
    reasons.push({ type: "profile_overstocked" });
  }
  if (
    context.opportunity.reasons.some((reason) => reason.type === "development_congestion") ||
    (context.opportunity.resourceCompetitionScore ?? 0) >= 0.65
  ) {
    reasons.push({ type: "high_resource_competition" });
  }
  if ((scores.clubFit ?? 0) < config.strongClubFitThreshold)
    reasons.push({ type: "limited_internal_opportunity" });
  if (evidence.strongCurrentValue) reasons.push({ type: "strong_market_value" });
  if ((scores.developmentOpportunity ?? 0) <= config.limitedDevelopmentOpportunityThreshold) {
    reasons.push({ type: "low_development_upside" });
  }
  if ((scores.economicOpportunity ?? 1) <= config.lowEconomicOpportunityThreshold) {
    reasons.push({ type: "low_economic_value" });
  }
  if (recommendedProfile && recommendedProfile !== context.prospect.suggestedProfile) {
    reasons.push({ type: "better_alternative_profile", profile: recommendedProfile });
  }
  if (decision === "unknown") reasons.push({ type: "insufficient_evidence" });
  if (decision === "hold") reasons.push({ type: "insufficient_training_snapshots" });
  return uniqueReasons(reasons);
}

function buildRisks(
  context: YouthDecisionContext,
  scores: YouthDecisionScores,
  evidence: EconomicEvidence,
  config: YouthDecisionConfig
): YouthDecisionRisk[] {
  const risks: YouthDecisionRisk[] = [];
  if (context.prospect.confidence === "low") risks.push({ type: "talent_uncertain" });
  if (evidence.currentConfidence === null || evidence.currentConfidence === "low") {
    risks.push({ type: "market_value_uncertain" }, { type: "low_market_evidence" });
  }
  if (context.opportunity.advancedTraining?.opportunity === "unlikely")
    risks.push({ type: "advanced_slot_unlikely" });
  if (context.opportunity.reasons.some((reason) => reason.type === "profile_overstocked")) {
    risks.push({ type: "profile_congestion" });
  }
  const weeks =
    context.marketProjection?.completion?.estimatedWeeks ??
    context.developmentProjection?.completion.estimatedWeeks;
  if (weeks !== null && weeks !== undefined && weeks > config.maximumTrainingWeeksForEfficiency) {
    risks.push({ type: "long_development_horizon" });
  }
  if ((context.opportunity.succession?.timingGapWeeks ?? 0) > 0)
    risks.push({ type: "successor_timing_risk" });
  if (scores.economicOpportunity === null || evidence.projectionConfidence === "low") {
    risks.push({ type: "low_market_evidence" });
  }
  return uniqueRisks(risks);
}

function calculateSportingConfidence(context: YouthDecisionContext): Confidence {
  return minimumConfidence(context.prospect.confidence, context.opportunity.confidence);
}

function calculateEconomicConfidence(evidence: EconomicEvidence): Confidence {
  let confidence = evidence.currentConfidence ?? "low";
  if (evidence.projectionConfidence !== null) {
    confidence = minimumConfidence(confidence, evidence.projectionConfidence);
  }
  return confidence;
}

function calculatePriority(
  decision: YouthDecision,
  scores: YouthDecisionScores,
  evidence: EconomicEvidence,
  config: YouthDecisionConfig
): YouthDecisionPriority {
  if (decision === "release" || decision === "hold" || decision === "unknown") return "low";
  const urgency = Math.max(
    scores.prospectQuality ?? 0,
    scores.clubFit ?? 0,
    scores.economicOpportunity ?? 0,
    scores.resourceEfficiency ?? 0,
    evidence.highValueCreation ? 0.85 : 0
  );
  if (decision === "train" && urgency >= config.highPriorityThreshold) return "high";
  if (urgency >= config.mediumPriorityThreshold) return "medium";
  return "low";
}

function compareDecisions(
  left: YouthDecisionRecommendation,
  right: YouthDecisionRecommendation
): number {
  const priorityRank: Record<YouthDecisionPriority, number> = { high: 3, medium: 2, low: 1 };
  const confidenceRank: Record<Confidence, number> = { high: 3, medium: 2, low: 1 };
  const needRank: Record<YouthDecision, number> = {
    hold: 6,
    unknown: 5,
    train: 4,
    sell: 3,
    keep: 2,
    release: 1
  };
  return (
    needRank[right.decision] - needRank[left.decision] ||
    priorityRank[right.priority] - priorityRank[left.priority] ||
    confidenceRank[right.sportingConfidence] - confidenceRank[left.sportingConfidence] ||
    (right.scores.prospectQuality ?? -1) - (left.scores.prospectQuality ?? -1) ||
    left.playerId - right.playerId
  );
}

function currentMarketValue(
  value: CalibratedPlayerMarketValueEstimate | PlayerMarketValueEstimate | null | undefined
): number | null {
  if (!value) return null;
  const range = "calibratedValue" in value ? value.calibratedValue : value.estimatedValue;
  return finiteNonNegative(range.expected);
}

function normalizeMarketAmount(value: number | null, reference: number): number | null {
  if (value === null || !Number.isFinite(value) || reference <= 0) return null;
  return roundScore(value / (value + reference));
}

function maxNullable(left: number | null, right: number | null): number | null {
  if (left === null) return right;
  if (right === null) return left;
  return Math.max(left, right);
}

function finiteScore(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? clamp(value, 0, 1) : null;
}

function finiteNonNegative(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function weightedAverage(values: Array<{ value: number; weight: number }>): number {
  const totalWeight = values.reduce((total, value) => total + value.weight, 0);
  return totalWeight === 0
    ? 0
    : values.reduce((total, value) => total + value.value * value.weight, 0) / totalWeight;
}

function confidenceAtLeast(left: Confidence, right: Confidence): boolean {
  const rank: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
  return rank[left] >= rank[right];
}

function minimumConfidence(left: Confidence, right: Confidence): Confidence {
  const rank: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
  return rank[left] <= rank[right] ? left : right;
}

function uniqueReasons(reasons: YouthDecisionReason[]): YouthDecisionReason[] {
  const seen = new Set<string>();
  return reasons.filter((reason) => {
    const key = JSON.stringify(reason);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isPositiveReason(reason: YouthDecisionReason): boolean {
  return [
    "elite_prospect",
    "strong_club_fit",
    "fills_future_squad_need",
    "succession_candidate",
    "high_development_upside",
    "high_development_value_creation",
    "high_training_value_efficiency",
    "advanced_training_candidate",
    "formation_development_viable",
    "better_alternative_profile"
  ].includes(reason.type);
}

function isNegativeReason(reason: YouthDecisionReason): boolean {
  return [
    "profile_overstocked",
    "limited_internal_opportunity",
    "high_resource_competition",
    "low_development_upside",
    "low_economic_value",
    "insufficient_evidence",
    "insufficient_training_snapshots"
  ].includes(reason.type);
}

function uniqueRisks(risks: YouthDecisionRisk[]): YouthDecisionRisk[] {
  const seen = new Set<string>();
  return risks.filter((risk) => {
    const key = JSON.stringify(risk);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function roundScore(value: number): number {
  return Number.isFinite(value) ? Number(clamp(value, 0, 1).toFixed(4)) : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
