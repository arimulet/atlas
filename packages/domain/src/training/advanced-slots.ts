import {
  calculateDevelopmentReturnScoreBreakdown,
  calculateWeeklyTrainingPointsByKind,
  detectSkillUps,
  getTrainingWeeks,
  isSkillTrainableForPosition
} from "./index.js";
import {
  ADVANCED_SLOT_HIGH_DEVELOPMENT_POTENTIAL_THRESHOLD,
  ADVANCED_SLOT_REPLACEMENT_THRESHOLD,
  ADVANCED_TRAINING_SLOT_COUNT,
  BASE_TRAINING_AGE,
  MAX_EFFICIENCY,
  MAX_SKILL_LEVEL
} from "./constants.js";
import type {
  AdvancedSlotEvaluation,
  AdvancedSlotReason,
  AdvancedSlotReplacement,
  AdvancedSlotScoreInput,
  AdvancedTrainingCandidateContext,
  AdvancedTrainingOptimization,
  AdvancedTrainingPlayerRecommendation,
  AdvancedTrainingRankingEntry,
  AdvancedTrainingRecommendation,
  SkillTrainingCostSkill,
  TrainingHistory,
  TrainingRecommendationConfidence,
  TrainingRecommendationPlayer,
  TrainingOptionScoreBreakdown
} from "./types.js";

export function optimizeAdvancedTrainingSlots(
  contexts: readonly AdvancedTrainingCandidateContext[],
  gameWeek?: number
): AdvancedTrainingOptimization {
  const resolvedGameWeek = gameWeek ?? latestGameWeek(contexts);
  const candidates = contexts.map((context) => evaluateCandidate(context, resolvedGameWeek));
  const eligible = candidates.filter((candidate) => candidate.isEligible);
  const ranking = buildRanking(eligible);
  const idealIds = ranking
    .filter((entry) => entry.score !== null)
    .slice(0, ADVANCED_TRAINING_SLOT_COUNT)
    .map((entry) => entry.playerId);
  const recommendedIds = selectOperationalAdvancedPlayers(candidates, eligible, idealIds);
  const operationalRanking = ranking.map((entry) => ({
    ...entry,
    recommendedAdvanced: recommendedIds.includes(entry.playerId)
  }));
  const replacements = buildReplacements(candidates, recommendedIds);
  const recommendations = candidates.map((candidate) =>
    buildPlayerRecommendation(candidate, recommendedIds, operationalRanking, replacements)
  );
  const promotions = recommendations.filter(
    (recommendation) => recommendation.status === "promote_to_advanced"
  ).length;
  const removals = recommendations.filter(
    (recommendation) => recommendation.status === "remove_from_advanced"
  ).length;

  return {
    gameWeek: resolvedGameWeek,
    slotCount: ADVANCED_TRAINING_SLOT_COUNT,
    ranking: operationalRanking,
    recommendedAdvancedPlayerIds: recommendedIds,
    recommendations,
    replacements,
    summary: {
      currentlyAdvanced: candidates.filter((candidate) => candidate.currentlyAdvanced).length,
      recommendedChanges: promotions + removals,
      promotions,
      removals
    }
  };
}

export function isEligibleForAdvancedTraining(
  player: TrainingRecommendationPlayer,
  currentTraining: AdvancedTrainingCandidateContext["currentTraining"]
): boolean {
  return (
    Number.isInteger(player.playerId) &&
    player.playerId > 0 &&
    Number.isFinite(player.age) &&
    player.age >= BASE_TRAINING_AGE &&
    isSkillTrainableForPosition(player.position, currentTraining.skill) &&
    (currentTraining.kind === "advanced" || currentTraining.kind === "formation") &&
    Number.isFinite(currentTraining.intensity) &&
    currentTraining.intensity >= 0 &&
    currentTraining.intensity <= MAX_EFFICIENCY
  );
}

export function calculateAdvancedSlotScore(input: AdvancedSlotScoreInput): number | null {
  if (
    !Number.isFinite(input.marginalTrainingPoints) ||
    input.marginalTrainingPoints <= 0 ||
    !Number.isFinite(input.developmentPotentialScore) ||
    input.developmentPotentialScore < 0
  ) {
    return null;
  }

  const normalizedMarginalBenefit = input.marginalTrainingPoints / MAX_EFFICIENCY;
  return Math.min(1, normalizedMarginalBenefit * input.developmentPotentialScore);
}

export function buildAdvancedScoreBreakdown(input: {
  marginalTrainingPoints: number;
  developmentPotentialScore: number;
  optionBreakdown?: TrainingOptionScoreBreakdown | null;
}): AdvancedSlotEvaluation["scoreBreakdown"] | null {
  const finalScore = calculateAdvancedSlotScore(input);
  if (finalScore === null) {
    return null;
  }

  return {
    marginalTrainingGain: input.marginalTrainingPoints / MAX_EFFICIENCY,
    developmentPotential: input.developmentPotentialScore,
    talentContribution: input.optionBreakdown?.talent,
    ageContribution: input.optionBreakdown
      ? 1 / input.optionBreakdown.ageCostFactor
      : 1,
    finalScore
  };
}

interface EvaluatedCandidate {
  context: AdvancedTrainingCandidateContext;
  evaluation: AdvancedSlotEvaluation;
  isEligible: boolean;
  currentlyAdvanced: boolean;
  confidence: TrainingRecommendationConfidence;
}

function evaluateCandidate(
  context: AdvancedTrainingCandidateContext,
  gameWeek: number
): EvaluatedCandidate {
  const currentTraining = context.currentTraining;
  const isEligible = isEligibleForAdvancedTraining(context.player, currentTraining);
  const currentlyAdvanced = currentTraining.kind === "advanced";
  const history = historyForPlayer(context.trainingHistory, context.player.playerId);
  const confidence = candidateConfidence(context, history, gameWeek, isEligible);
  const currentSkill = currentTraining.skill;

  if (!isEligible) {
    return {
      context,
      evaluation: {
        playerId: context.player.playerId,
        currentSkill,
        advancedScore: null,
        expectedAdvancedTrainingPoints: null,
        expectedFormationTrainingPoints: null,
        marginalTrainingPoints: null,
        developmentPotentialScore: null,
        confidence
      },
      isEligible,
      currentlyAdvanced,
      confidence
    };
  }

  const calculatedAdvancedTrainingPoints = calculateWeeklyTrainingPointsByKind({
    intensity: currentTraining.intensity,
    kind: "advanced"
  });
  const calculatedFormationTrainingPoints = calculateWeeklyTrainingPointsByKind({
    intensity: currentTraining.intensity,
    kind: "formation"
  });
  const expectedAdvancedTrainingPoints =
    calculatedAdvancedTrainingPoints > 0 ? calculatedAdvancedTrainingPoints : null;
  const expectedFormationTrainingPoints =
    calculatedFormationTrainingPoints > 0 ? calculatedFormationTrainingPoints : null;
  const marginalTrainingPoints =
    expectedAdvancedTrainingPoints !== null && expectedFormationTrainingPoints !== null
      ? expectedAdvancedTrainingPoints - expectedFormationTrainingPoints
      : null;
  const preferredSkill = preferredSkillFor(context);
  const preferredLevel = levelForPreferredSkill(context, preferredSkill);
  const developmentPotentialBreakdown =
    preferredLevel === null || expectedAdvancedTrainingPoints === null
      ? null
      : calculateDevelopmentReturnScoreBreakdown({
          age: context.player.age,
          talent: context.talent?.value ?? null,
          skill: preferredSkill,
          currentSkillLevel: preferredLevel,
          expectedWeeklyTrainingPoints: expectedAdvancedTrainingPoints
        });
  const developmentPotentialScore = developmentPotentialBreakdown?.developmentReturnScore ?? null;
  const advancedScore =
    developmentPotentialScore === null || marginalTrainingPoints === null
      ? null
      : calculateAdvancedSlotScore({ marginalTrainingPoints, developmentPotentialScore });
  const scoreBreakdown =
    developmentPotentialScore === null || marginalTrainingPoints === null
      ? null
      : buildAdvancedScoreBreakdown({
          marginalTrainingPoints,
          developmentPotentialScore,
          optionBreakdown: developmentPotentialBreakdown
        });

  return {
    context,
    evaluation: {
      playerId: context.player.playerId,
      currentSkill,
      advancedScore,
      expectedAdvancedTrainingPoints,
      expectedFormationTrainingPoints,
      marginalTrainingPoints,
      developmentPotentialScore,
      ...(scoreBreakdown ? { scoreBreakdown } : {}),
      confidence
    },
    isEligible,
    currentlyAdvanced,
    confidence
  };
}

function preferredSkillFor(context: AdvancedTrainingCandidateContext): SkillTrainingCostSkill {
  if (
    context.trainingRecommendation?.status === "switch_skill" &&
    context.trainingRecommendation.recommendedSkill !== undefined
  ) {
    return context.trainingRecommendation.recommendedSkill;
  }

  return context.currentTraining.skill;
}

function levelForPreferredSkill(
  context: AdvancedTrainingCandidateContext,
  skill: SkillTrainingCostSkill
): number | null {
  if (skill === context.currentTraining.skill && context.weeklyReport) {
    return context.weeklyReport.skill.currentLevel;
  }

  if (context.trainingRecommendation) {
    const option = [
      context.trainingRecommendation.currentOption,
      ...context.trainingRecommendation.alternatives
    ].find((candidate) => candidate.skill === skill);
    if (option) {
      return option.currentLevel;
    }
  }

  const playerSkill = skill === "scoring" ? "striker" : skill;
  const level = context.player.skills[playerSkill];
  return level !== undefined && Number.isInteger(level) && level >= 0 && level <= MAX_SKILL_LEVEL
    ? level
    : null;
}

function candidateConfidence(
  context: AdvancedTrainingCandidateContext,
  history: TrainingHistory | null,
  gameWeek: number,
  isEligible: boolean
): TrainingRecommendationConfidence {
  if (!isEligible || !history || history.weeks.length < 2) {
    return "low";
  }

  const currentWeek = history.weeks.find((week) => week.week === gameWeek);
  const hasSkillUp = currentWeek
    ? detectSkillUps(history).some((skillUp) => skillUp.skill === context.currentTraining.skill)
    : false;
  const talentIsStable = context.talent?.value !== null && context.talent?.value !== undefined;
  const recommendationConfidence = context.trainingRecommendation?.confidence;

  if (
    talentIsStable &&
    context.talent?.confidence === "high" &&
    (hasSkillUp || recommendationConfidence === "high")
  ) {
    return "high";
  }

  if (talentIsStable || recommendationConfidence === "medium" || hasSkillUp) {
    return "medium";
  }

  return "low";
}

function buildRanking(candidates: readonly EvaluatedCandidate[]): AdvancedTrainingRankingEntry[] {
  return [...candidates].sort(compareCandidates).map((candidate, index) => ({
    playerId: candidate.evaluation.playerId,
    rank: index + 1,
    score: candidate.evaluation.advancedScore,
    currentlyAdvanced: candidate.currentlyAdvanced,
    recommendedAdvanced: false,
    confidence: candidate.confidence
  }));
}

function compareCandidates(left: EvaluatedCandidate, right: EvaluatedCandidate): number {
  const leftScore = left.evaluation.advancedScore;
  const rightScore = right.evaluation.advancedScore;

  if (leftScore === null && rightScore === null) {
    return left.evaluation.playerId - right.evaluation.playerId;
  }
  if (leftScore === null) return 1;
  if (rightScore === null) return -1;

  return rightScore - leftScore || left.evaluation.playerId - right.evaluation.playerId;
}

function selectOperationalAdvancedPlayers(
  candidates: readonly EvaluatedCandidate[],
  eligible: readonly EvaluatedCandidate[],
  idealIds: readonly number[]
): number[] {
  const selected = eligible
    .filter((candidate) => candidate.currentlyAdvanced)
    .sort(compareCandidates)
    .slice(0, ADVANCED_TRAINING_SLOT_COUNT)
    .map((candidate) => candidate.evaluation.playerId);
  const idealIdSet = new Set(idealIds);
  const operationalCandidates = eligible
    .filter(
      (candidate) =>
        !candidate.currentlyAdvanced &&
        idealIdSet.has(candidate.evaluation.playerId) &&
        candidate.evaluation.advancedScore !== null &&
        candidate.confidence !== "low"
    )
    .sort(compareCandidates);

  for (const candidate of operationalCandidates) {
    if (selected.length < ADVANCED_TRAINING_SLOT_COUNT) {
      selected.push(candidate.evaluation.playerId);
      continue;
    }

    const selectedCandidates = selected
      .map((playerId) => candidates.find((item) => item.evaluation.playerId === playerId))
      .filter((item): item is EvaluatedCandidate => item !== undefined)
      .sort(compareCandidates)
      .reverse();
    const replaceable = selectedCandidates[0];
    if (!replaceable || !shouldReplace(replaceable, candidate)) {
      continue;
    }

    const replaceableIndex = selected.indexOf(replaceable.evaluation.playerId);
    selected[replaceableIndex] = candidate.evaluation.playerId;
  }

  return selected.slice(0, ADVANCED_TRAINING_SLOT_COUNT);
}

function shouldReplace(current: EvaluatedCandidate, candidate: EvaluatedCandidate): boolean {
  if (
    current.evaluation.advancedScore === null ||
    candidate.evaluation.advancedScore === null ||
    current.confidence === "low" ||
    candidate.confidence === "low"
  ) {
    return false;
  }

  return (
    candidate.evaluation.advancedScore - current.evaluation.advancedScore >
    ADVANCED_SLOT_REPLACEMENT_THRESHOLD
  );
}

function buildReplacements(
  candidates: readonly EvaluatedCandidate[],
  recommendedIds: readonly number[]
): AdvancedSlotReplacement[] {
  const promoted = candidates
    .filter(
      (candidate) =>
        candidate.isEligible &&
        !candidate.currentlyAdvanced &&
        recommendedIds.includes(candidate.evaluation.playerId)
    )
    .sort(compareCandidates);
  const removed = candidates
    .filter(
      (candidate) =>
        candidate.currentlyAdvanced && !recommendedIds.includes(candidate.evaluation.playerId)
    )
    .sort(compareCandidates)
    .reverse();
  const replacements: AdvancedSlotReplacement[] = [];

  for (let index = 0; index < Math.min(promoted.length, removed.length); index += 1) {
    const promote = promoted[index];
    const remove = removed[index];
    if (
      !promote ||
      !remove ||
      promote.confidence === "low" ||
      remove.confidence === "low" ||
      promote.evaluation.advancedScore === null ||
      remove.evaluation.advancedScore === null
    ) {
      continue;
    }

    const scoreDifference = promote.evaluation.advancedScore - remove.evaluation.advancedScore;
    if (scoreDifference <= ADVANCED_SLOT_REPLACEMENT_THRESHOLD) {
      continue;
    }

    replacements.push({
      promotePlayerId: promote.evaluation.playerId,
      removePlayerId: remove.evaluation.playerId,
      scoreDifference,
      confidence: lowerConfidence(promote.confidence, remove.confidence),
      reasons: [
        {
          type: "better_candidate_available",
          playerId: promote.evaluation.playerId,
          scoreDifference
        }
      ]
    });
  }

  return replacements;
}

function buildPlayerRecommendation(
  candidate: EvaluatedCandidate,
  recommendedIds: readonly number[],
  ranking: readonly AdvancedTrainingRankingEntry[],
  replacements: readonly AdvancedSlotReplacement[]
): AdvancedTrainingPlayerRecommendation {
  const playerId = candidate.evaluation.playerId;
  const recommendedAdvanced = recommendedIds.includes(playerId);
  const rank = ranking.find((entry) => entry.playerId === playerId)?.rank ?? null;
  const replacement = replacements.find(
    (item) => item.promotePlayerId === playerId || item.removePlayerId === playerId
  );
  const reasons = reasonsForCandidate(candidate, recommendedAdvanced, rank, replacement);
  let status: AdvancedTrainingRecommendation;

  if (!candidate.isEligible || candidate.confidence === "low") {
    status = "hold";
  } else if (candidate.currentlyAdvanced && recommendedAdvanced) {
    status = "keep_advanced";
  } else if (!candidate.currentlyAdvanced && recommendedAdvanced) {
    status = "promote_to_advanced";
  } else if (candidate.currentlyAdvanced) {
    status = "remove_from_advanced";
  } else {
    status = "keep_formation";
  }

  return {
    playerId,
    status,
    currentlyAdvanced: candidate.currentlyAdvanced,
    recommendedAdvanced,
    evaluation: candidate.evaluation,
    reasons
  };
}

function reasonsForCandidate(
  candidate: EvaluatedCandidate,
  recommendedAdvanced: boolean,
  rank: number | null,
  replacement: AdvancedSlotReplacement | undefined
): AdvancedSlotReason[] {
  if (!candidate.isEligible || candidate.evaluation.advancedScore === null) {
    return [{ type: "insufficient_data" }];
  }

  const reasons: AdvancedSlotReason[] = [];
  const evaluation = candidate.evaluation;
  if (evaluation.marginalTrainingPoints !== null) {
    reasons.push({ type: "high_marginal_training_gain", value: evaluation.marginalTrainingPoints });
  }
  if (
    evaluation.developmentPotentialScore !== null &&
    evaluation.developmentPotentialScore >= ADVANCED_SLOT_HIGH_DEVELOPMENT_POTENTIAL_THRESHOLD
  ) {
    reasons.push({ type: "high_development_potential" });
  } else {
    reasons.push({ type: "low_development_potential" });
  }

  if (recommendedAdvanced && rank !== null) {
    reasons.push({ type: "within_recommended_top_slots", rank });
  } else if (rank !== null) {
    reasons.push({ type: "below_advanced_cutoff", rank });
  }

  if (
    replacement &&
    (replacement.removePlayerId === candidate.evaluation.playerId ||
      replacement.promotePlayerId === candidate.evaluation.playerId)
  ) {
    reasons.push({
      type: "better_candidate_available",
      playerId: replacement.promotePlayerId,
      scoreDifference: replacement.scoreDifference
    });
  }

  return reasons;
}

function historyForPlayer(
  histories: TrainingHistory | readonly TrainingHistory[],
  playerId: number
): TrainingHistory | null {
  if (Array.isArray(histories)) {
    return histories.find((history) => history.playerId === playerId) ?? null;
  }

  return "playerId" in histories && histories.playerId === playerId ? histories : null;
}

function latestGameWeek(contexts: readonly AdvancedTrainingCandidateContext[]): number {
  const gameWeeks = contexts.flatMap((context) => {
    const reportWeek = context.weeklyReport?.gameWeek;
    const histories = historyForPlayer(context.trainingHistory, context.player.playerId);
    const historyWeek = getTrainingWeeks(
      histories ?? { playerId: context.player.playerId, weeks: [] }
    ).at(-1)?.week;
    return [reportWeek, historyWeek].filter((week): week is number => week !== undefined);
  });
  const latest = Math.max(...gameWeeks);
  if (!Number.isInteger(latest) || latest <= 0) {
    throw new Error("At least one training week is required to optimize advanced slots.");
  }
  return latest;
}

function lowerConfidence(
  left: TrainingRecommendationConfidence,
  right: TrainingRecommendationConfidence
): TrainingRecommendationConfidence {
  if (left === "low" || right === "low") return "low";
  if (left === "medium" || right === "medium") return "medium";
  return "high";
}
