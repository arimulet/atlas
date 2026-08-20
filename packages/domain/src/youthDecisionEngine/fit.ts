import { BASE_TRAINING_AGE, calculateRelativeTrainingSpeed } from "../training/index.js";
import {
  evaluateDevelopmentProfiles,
  type DevelopmentProfile,
  type PlayerDevelopmentProjection
} from "../playerDevelopment/index.js";
import type {
  ProfileDepthAssessment,
  SquadPlanningHorizon,
  SquadPlanningRecommendation
} from "../squadPlanning/index.js";
import type { Confidence } from "../types.js";
import {
  YOUTH_FIT_CONFIG,
  type YouthAdvancedTrainingOpportunity,
  type YouthDevelopmentOpportunity,
  type YouthFitConfig,
  type YouthFitContext,
  type YouthFitReason,
  type YouthProfileDevelopmentCapacity,
  type YouthReprofileOpportunity,
  type YouthStrategicAssessment,
  type YouthSuccessionFit
} from "./fit-types.js";

export function assessYouthDevelopmentOpportunity(
  context: YouthFitContext,
  config: Partial<YouthFitConfig> = {}
): YouthDevelopmentOpportunity {
  const resolvedConfig = { ...YOUTH_FIT_CONFIG, ...config };
  const profile = context.prospectAssessment.suggestedProfile;
  const depth = profile ? findDepthAssessment(context, profile) : null;
  const projection = context.developmentProjection ?? null;
  const advancedTraining = profile ? calculateAdvancedOpportunity(context, resolvedConfig) : null;
  const squadNeedScore = profile ? calculateSquadNeed(context, depth, resolvedConfig) : null;
  const succession = profile
    ? calculateSuccessionFit(context, depth, projection, resolvedConfig)
    : null;
  const developmentOpportunityScore = profile
    ? calculateDevelopmentOpportunity(context, projection, advancedTraining, resolvedConfig)
    : null;
  const resourceCompetitionScore = profile
    ? calculateResourceCompetition(depth, advancedTraining)
    : null;
  const reprofileOpportunity = profile
    ? calculateReprofileOpportunity(context, profile, resolvedConfig)
    : null;
  const developmentCapacity = profile
    ? calculateDevelopmentCapacity(context, depth, resourceCompetitionScore)
    : null;
  const clubFitScore = calculateClubFitScore({
    squadNeedScore,
    successionFitScore: succession?.score ?? null,
    developmentOpportunityScore,
    resourceCompetitionScore,
    config: resolvedConfig
  });
  const reasons = buildReasons({
    context,
    profile,
    depth,
    squadNeedScore,
    succession,
    advancedTraining,
    developmentOpportunityScore,
    resourceCompetitionScore,
    reprofileOpportunity,
    projection
  });
  const confidence = calculateConfidence({
    context,
    depth,
    projection,
    advancedTraining,
    profile
  });
  const opportunity = classifyOpportunity(clubFitScore, confidence, {
    hasProfile: profile !== null,
    hasDepth: depth !== null,
    hasSquadAssessment: context.squadAssessment !== null && context.squadAssessment !== undefined,
    hasProjection: projection !== null,
    config: resolvedConfig
  });

  return {
    playerId: context.player.playerId,
    profile,
    squadNeedScore,
    successionFitScore: succession?.score ?? null,
    developmentOpportunityScore,
    resourceCompetitionScore,
    clubFitScore,
    opportunity,
    confidence,
    reasons,
    succession,
    advancedTraining,
    reprofileOpportunity,
    developmentCapacity
  };
}

export function evaluateYouthDevelopmentOpportunities(
  contexts: readonly YouthFitContext[],
  config: Partial<YouthFitConfig> = {}
): YouthDevelopmentOpportunity[] {
  return contexts
    .map((context) => assessYouthDevelopmentOpportunity(context, config))
    .sort(compareYouthFit);
}

export function assessYouthStrategicAssessment(
  context: YouthFitContext,
  config: Partial<YouthFitConfig> = {}
): YouthStrategicAssessment {
  return {
    prospect: context.prospectAssessment,
    opportunity: assessYouthDevelopmentOpportunity(context, config)
  };
}

function findDepthAssessment(
  context: YouthFitContext,
  profile: DevelopmentProfile
): ProfileDepthAssessment | null {
  return (
    context.depthAnalysis?.profiles.find((assessment) => assessment.profile === profile) ?? null
  );
}

function calculateSquadNeed(
  context: YouthFitContext,
  depth: ProfileDepthAssessment | null,
  config: YouthFitConfig
): number | null {
  if (!depth) return null;

  const current = horizonNeed(depth, "current");
  const nextSeason = horizonNeed(depth, "next_season");
  const mediumTerm = horizonNeed(depth, "medium_term");
  const weightedNeed =
    current * config.currentHorizonWeight +
    nextSeason * config.nextSeasonHorizonWeight +
    mediumTerm * config.mediumTermHorizonWeight;
  const recommendationSignal = recommendationNeedSignal(context, depth.profile);
  return roundScore(weightedNeed * 0.75 + recommendationSignal * 0.25);
}

function horizonNeed(depth: ProfileDepthAssessment, horizon: SquadPlanningHorizon): number {
  const snapshot =
    horizon === "current"
      ? depth.current
      : horizon === "next_season"
        ? depth.nextSeason
        : depth.mediumTerm;
  const competitive = snapshot.strongOptions + snapshot.developingOptions;
  const minimum = depth.requirement.minimum;
  const ideal = depth.requirement.ideal;
  if (competitive < minimum) return 1;
  if (competitive >= ideal) return depth.status === "overstocked" ? 0.05 : 0.15;
  return clamp((ideal - competitive) / Math.max(ideal - minimum, 1), 0.2, 0.9);
}

function recommendationNeedSignal(context: YouthFitContext, profile: DevelopmentProfile): number {
  const recommendations =
    context.squadRecommendations?.recommendations.filter(
      (recommendation) => recommendation.profile === profile
    ) ?? [];
  if (recommendations.length === 0) return 0;
  const signalByType: Record<SquadPlanningRecommendation["type"], number> = {
    maintain: 0,
    develop_internal: 0.7,
    accelerate_development: 0.85,
    reprofile_player: 0.65,
    find_external: 1,
    reduce_depth: -0.8,
    prepare_successor: 0.9,
    monitor: 0.25
  };
  const signalByPriority = { critical: 1, high: 0.85, medium: 0.65, low: 0.4 } as const;
  return clamp(
    Math.max(
      ...recommendations.map(
        (recommendation) =>
          signalByType[recommendation.type] * signalByPriority[recommendation.priority]
      ),
      0
    ),
    0,
    1
  );
}

function calculateSuccessionFit(
  context: YouthFitContext,
  depth: ProfileDepthAssessment | null,
  projection: PlayerDevelopmentProjection | null,
  config: YouthFitConfig
): YouthSuccessionFit {
  if (!depth) {
    return {
      outgoingPlayerIds: [],
      projectedReadyGameWeek: projection?.completion.estimatedGameWeek ?? null,
      requiredReadyGameWeek: context.requiredReadyGameWeek ?? null,
      timingGapWeeks: null,
      score: null
    };
  }

  const projectedReadyGameWeek = projection?.completion.estimatedGameWeek ?? null;
  const requiredReadyGameWeek = context.requiredReadyGameWeek ?? inferRequiredReadyGameWeek(depth);
  const timingGapWeeks =
    projectedReadyGameWeek !== null && requiredReadyGameWeek !== null
      ? projectedReadyGameWeek - requiredReadyGameWeek
      : null;
  const timingScore = calculateTimingScore(timingGapWeeks, config);
  const existingSuccessors = depth.succession.successorCandidates;
  const existingBest = Math.max(
    ...existingSuccessors.map((candidate) => candidate.futureContributionScore ?? 0),
    0
  );
  const youthFutureScore =
    context.projectedFutureContributionScore ?? context.prospectAssessment.prospectScore;
  const competitionAdjustment =
    existingSuccessors.length === 0
      ? 1
      : youthFutureScore === null
        ? 0.6
        : clamp(1 - Math.max(existingBest - youthFutureScore, 0) * 0.8, 0.35, 1);
  let baseScore: number;
  if (!depth.succession.successionRequired) {
    baseScore = 0.35;
  } else if (depth.succession.coverageStatus === "missing") {
    baseScore = 1;
  } else if (depth.succession.coverageStatus === "at_risk") {
    baseScore = 0.75;
  } else {
    baseScore = 0.35;
  }
  const score = roundNullable(
    baseScore * 0.65 * competitionAdjustment + (timingScore ?? 0.5) * 0.35
  );

  return {
    outgoingPlayerIds: [...depth.succession.outgoingPlayers],
    projectedReadyGameWeek,
    requiredReadyGameWeek,
    timingGapWeeks,
    score
  };
}

function inferRequiredReadyGameWeek(depth: ProfileDepthAssessment): number | null {
  const outgoingDeadline = depth.succession.successorCandidates
    .map((candidate) => candidate.estimatedReadyGameWeek)
    .filter((value): value is number => value !== null && value !== undefined)
    .sort((left, right) => left - right)[0];
  return outgoingDeadline ?? null;
}

function calculateTimingScore(
  timingGapWeeks: number | null,
  config: YouthFitConfig
): number | null {
  if (timingGapWeeks === null) return null;
  if (timingGapWeeks <= 0) return 1;
  if (timingGapWeeks <= config.successionReadyWindowWeeks) return 0.8;
  if (timingGapWeeks <= config.successionLateWindowWeeks) return 0.5;
  return 0.2;
}

function calculateDevelopmentOpportunity(
  context: YouthFitContext,
  projection: PlayerDevelopmentProjection | null,
  advancedTraining: YouthAdvancedTrainingOpportunity | null,
  config: YouthFitConfig
): number | null {
  const targetExists = Boolean(
    context.developmentPlan?.target ?? context.prospectAssessment.suggestedDevelopmentTarget
  );
  const pathExists = context.trainingPath !== null && context.trainingPath !== undefined;
  const projectionScore = projection
    ? projection.projectionStatus === "projected"
      ? 0.95
      : projection.projectionStatus === "partial"
        ? 0.6
        : 0.25
    : null;
  const trainingModeScore = projection
    ? projection.assumptions.trainingKind === "advanced"
      ? advancedOpportunityScore(advancedTraining)
      : 0.65
    : null;
  const ageScore = readAgeScore(context.player.age);
  const components = [
    { value: targetExists ? 0.8 : 0.35, weight: 0.2 },
    { value: pathExists ? 0.85 : 0.4, weight: 0.15 },
    { value: projectionScore, weight: 0.35 },
    { value: trainingModeScore, weight: 0.15 },
    { value: ageScore, weight: 0.15 }
  ].filter((component): component is { value: number; weight: number } => component.value !== null);
  if (components.length === 0) return null;
  const score = weightedAverage(components);
  return config.confidencePenaltyForUnknownProjection && projection === null
    ? roundScore(score * 0.75)
    : roundScore(score);
}

function advancedOpportunityScore(
  advancedTraining: YouthAdvancedTrainingOpportunity | null
): number | null {
  if (!advancedTraining) return null;
  if (advancedTraining.opportunity === "likely") return 1;
  if (advancedTraining.opportunity === "competitive") return 0.75;
  if (advancedTraining.opportunity === "unlikely") return 0.35;
  return 0.5;
}

function readAgeScore(age: number | null | undefined): number | null {
  if (typeof age !== "number" || !Number.isFinite(age) || age < BASE_TRAINING_AGE) return null;
  return clamp(calculateRelativeTrainingSpeed(age), 0.25, 1);
}

function calculateAdvancedOpportunity(
  context: YouthFitContext,
  config: YouthFitConfig
): YouthAdvancedTrainingOpportunity {
  const optimization = context.advancedTraining;
  const entry = optimization?.ranking.find(
    (candidate) => candidate.playerId === context.player.playerId
  );
  if (!optimization || !entry) {
    return {
      projectedRank: null,
      currentCutoffScore: null,
      candidateScore: null,
      opportunity: "unknown"
    };
  }
  const cutoff =
    optimization.ranking.find((candidate) => candidate.rank === optimization.slotCount - 1)
      ?.score ??
    optimization.ranking.find((candidate) => candidate.rank === optimization.slotCount)?.score ??
    null;
  const opportunity =
    entry.rank <= optimization.slotCount
      ? "likely"
      : entry.rank <= optimization.slotCount + config.advancedCompetitiveRankBuffer
        ? "competitive"
        : "unlikely";
  return {
    projectedRank: entry.rank,
    currentCutoffScore: cutoff,
    candidateScore: entry.score,
    opportunity
  };
}

function calculateResourceCompetition(
  depth: ProfileDepthAssessment | null,
  advancedTraining: YouthAdvancedTrainingOpportunity | null
): number | null {
  if (!depth) return null;
  const futureCandidates = depth.mediumTerm.developingOptions + depth.mediumTerm.prospects;
  const projectedFutureSlots = Math.max(depth.requirement.ideal, 1);
  const afterInclusion = futureCandidates + 1;
  const pipelineCompetition = clamp(
    (afterInclusion - projectedFutureSlots) / projectedFutureSlots,
    0,
    1
  );
  const advancedCompetition =
    advancedTraining?.opportunity === "likely"
      ? 0
      : advancedTraining?.opportunity === "competitive"
        ? 0.25
        : advancedTraining?.opportunity === "unlikely"
          ? 0.7
          : 0.4;
  return roundScore(pipelineCompetition * 0.7 + advancedCompetition * 0.3);
}

function calculateDevelopmentCapacity(
  context: YouthFitContext,
  depth: ProfileDepthAssessment | null,
  resourceCompetitionScore: number | null
): YouthProfileDevelopmentCapacity | null {
  const profile = context.prospectAssessment.suggestedProfile;
  if (!profile || !depth) return null;
  return {
    profile,
    projectedFutureSlots: depth.requirement.ideal,
    currentDevelopingPlayers: depth.mediumTerm.developingOptions,
    prospects: depth.mediumTerm.prospects,
    youthCandidateIncluded: true,
    congestionAfterInclusion: resourceCompetitionScore ?? 0
  };
}

function calculateReprofileOpportunity(
  context: YouthFitContext,
  currentProfile: DevelopmentProfile,
  config: YouthFitConfig
): YouthReprofileOpportunity | null {
  const evaluations = evaluateDevelopmentProfiles(context.player);
  const currentEvaluation = evaluations.find((evaluation) => evaluation.profile === currentProfile);
  if (!currentEvaluation) return null;
  const alternative = evaluations
    .filter((evaluation) => evaluation.profile !== currentProfile)
    .map((evaluation) => ({ evaluation, depth: findDepthAssessment(context, evaluation.profile) }))
    .filter((entry) => entry.depth?.status === "critical" || entry.depth?.status === "thin")
    .map((entry) => {
      const compatibilityScore =
        currentEvaluation.score > 0
          ? clamp(entry.evaluation.score / currentEvaluation.score, 0, 1)
          : 0;
      const squadNeedImprovement = entry.depth
        ? (calculateSquadNeed(context, entry.depth, config) ?? 0)
        : 0;
      const currentNeed = findDepthAssessment(context, currentProfile);
      const currentNeedScore = currentNeed
        ? (calculateSquadNeed(context, currentNeed, config) ?? 0)
        : 0;
      return {
        alternativeProfile: entry.evaluation.profile,
        compatibilityScore,
        squadNeedImprovement: squadNeedImprovement - currentNeedScore
      };
    })
    .sort(
      (left, right) =>
        right.compatibilityScore - left.compatibilityScore ||
        right.squadNeedImprovement - left.squadNeedImprovement ||
        left.alternativeProfile.localeCompare(right.alternativeProfile)
    )[0];
  if (!alternative) return null;
  const viable =
    alternative.compatibilityScore >= config.reprofileCompatibilityThreshold &&
    alternative.squadNeedImprovement >= config.reprofileNeedImprovementThreshold;
  return {
    currentProfile,
    alternativeProfile: alternative.alternativeProfile,
    compatibilityScore: roundScore(alternative.compatibilityScore),
    squadNeedImprovement: roundScore(Math.max(alternative.squadNeedImprovement, 0)),
    viable
  };
}

function calculateClubFitScore(input: {
  squadNeedScore: number | null;
  successionFitScore: number | null;
  developmentOpportunityScore: number | null;
  resourceCompetitionScore: number | null;
  config: YouthFitConfig;
}): number | null {
  const components = [
    { value: input.squadNeedScore, weight: input.config.squadNeedWeight },
    { value: input.successionFitScore, weight: input.config.successionFitWeight },
    { value: input.developmentOpportunityScore, weight: input.config.developmentOpportunityWeight },
    {
      value: input.resourceCompetitionScore === null ? null : 1 - input.resourceCompetitionScore,
      weight: input.config.resourceCompetitionWeight
    }
  ].filter((component): component is { value: number; weight: number } => component.value !== null);
  if (components.length === 0) return null;
  return roundScore(weightedAverage(components));
}

function buildReasons(input: {
  context: YouthFitContext;
  profile: DevelopmentProfile | null;
  depth: ProfileDepthAssessment | null;
  squadNeedScore: number | null;
  succession: YouthSuccessionFit | null;
  advancedTraining: YouthAdvancedTrainingOpportunity | null;
  developmentOpportunityScore: number | null;
  resourceCompetitionScore: number | null;
  reprofileOpportunity: YouthReprofileOpportunity | null;
  projection: PlayerDevelopmentProjection | null;
}): YouthFitReason[] {
  const reasons: YouthFitReason[] = [];
  if (!input.profile || !input.depth) reasons.push({ type: "missing_squad_context" });
  if (input.profile && input.depth) {
    const horizon = strongestNeedHorizon(input.depth);
    if (input.squadNeedScore !== null && input.squadNeedScore >= 0.58) {
      reasons.push({ type: "profile_needed", profile: input.profile, horizon });
    }
    if (input.depth.status === "overstocked") reasons.push({ type: "profile_overstocked" });
    if (input.depth.reasons.some((reason) => reason.type === "development_congestion")) {
      reasons.push({ type: "development_congestion" });
    }
    if (
      input.depth.succession.successionRequired &&
      input.depth.succession.coverageStatus !== "covered"
    ) {
      reasons.push({ type: "succession_opportunity", profile: input.profile });
    }
  }
  if (input.succession?.timingGapWeeks !== null && input.succession?.timingGapWeeks !== undefined) {
    reasons.push(
      input.succession.timingGapWeeks <= 0
        ? { type: "projected_ready_in_time" }
        : { type: "projected_ready_too_late" }
    );
  }
  if (
    input.depth?.status === "critical" &&
    input.succession?.timingGapWeeks !== null &&
    (input.succession?.timingGapWeeks ?? 0) > 0
  ) {
    reasons.push({ type: "current_gap_not_solved_immediately" });
  }
  if (input.advancedTraining?.opportunity === "likely")
    reasons.push({ type: "advanced_training_likely" });
  if (input.advancedTraining?.opportunity === "unlikely")
    reasons.push({ type: "advanced_training_unlikely" });
  if (input.projection?.assumptions.trainingKind === "formation") {
    reasons.push({ type: "formation_training_viable" });
  }
  if (input.resourceCompetitionScore !== null && input.resourceCompetitionScore >= 0.65) {
    reasons.push({ type: "strong_internal_competition" });
  }
  if (input.reprofileOpportunity?.viable) {
    reasons.push({
      type: "reprofile_opportunity",
      profile: input.reprofileOpportunity.alternativeProfile
    });
  }
  if (!input.projection) reasons.push({ type: "missing_development_projection" });
  if (input.context.trainingPath === null || input.context.trainingPath === undefined) {
    reasons.push({ type: "incomplete_development_path" });
  }
  return uniqueReasons(reasons);
}

function strongestNeedHorizon(depth: ProfileDepthAssessment): SquadPlanningHorizon {
  const needs = [
    { horizon: "current" as const, value: horizonNeed(depth, "current") },
    { horizon: "next_season" as const, value: horizonNeed(depth, "next_season") },
    { horizon: "medium_term" as const, value: horizonNeed(depth, "medium_term") }
  ];
  return needs.sort(
    (left, right) =>
      right.value - left.value || horizonOrder(left.horizon) - horizonOrder(right.horizon)
  )[0]!.horizon;
}

function calculateConfidence(input: {
  context: YouthFitContext;
  depth: ProfileDepthAssessment | null;
  projection: PlayerDevelopmentProjection | null;
  advancedTraining: YouthAdvancedTrainingOpportunity | null;
  profile: DevelopmentProfile | null;
}): Confidence {
  if (!input.profile || !input.depth || !input.context.squadAssessment) return "low";
  if (input.context.prospectAssessment.confidence === "low" || input.depth.confidence === "low")
    return "low";
  if (input.projection?.projectionStatus === "unavailable") return "low";
  if (input.projection === null) return "low";
  if (input.advancedTraining?.opportunity === "unknown") return "medium";
  if (
    input.context.prospectAssessment.confidence === "high" &&
    input.depth.confidence === "high" &&
    input.projection.confidence === "high"
  )
    return "high";
  return "medium";
}

function classifyOpportunity(
  score: number | null,
  confidence: Confidence,
  input: {
    hasProfile: boolean;
    hasDepth: boolean;
    hasSquadAssessment: boolean;
    hasProjection: boolean;
    config: YouthFitConfig;
  }
): YouthDevelopmentOpportunity["opportunity"] {
  if (
    !input.hasProfile ||
    !input.hasDepth ||
    !input.hasSquadAssessment ||
    !input.hasProjection ||
    score === null
  )
    return "unknown";
  if (score >= input.config.excellentClubFitThreshold && confidence !== "low") return "excellent";
  if (score >= input.config.goodClubFitThreshold && confidence !== "low") return "good";
  if (score >= input.config.limitedClubFitThreshold) return "limited";
  return "poor";
}

function compareYouthFit(
  left: YouthDevelopmentOpportunity,
  right: YouthDevelopmentOpportunity
): number {
  if (left.clubFitScore === null && right.clubFitScore !== null) return 1;
  if (left.clubFitScore !== null && right.clubFitScore === null) return -1;
  return (right.clubFitScore ?? -1) - (left.clubFitScore ?? -1) || left.playerId - right.playerId;
}

function weightedAverage(values: Array<{ value: number; weight: number }>): number {
  const totalWeight = values.reduce((total, value) => total + value.weight, 0);
  return totalWeight === 0
    ? 0
    : values.reduce((total, value) => total + value.value * value.weight, 0) / totalWeight;
}

function uniqueReasons(reasons: YouthFitReason[]): YouthFitReason[] {
  const seen = new Set<string>();
  return reasons.filter((reason) => {
    const key = JSON.stringify(reason);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function horizonOrder(horizon: SquadPlanningHorizon): number {
  return horizon === "current" ? 0 : horizon === "next_season" ? 1 : 2;
}

function roundNullable(value: number | null): number | null {
  return value === null ? null : roundScore(value);
}

function roundScore(value: number): number {
  return Number.isFinite(value) ? Number(clamp(value, 0, 1).toFixed(4)) : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
