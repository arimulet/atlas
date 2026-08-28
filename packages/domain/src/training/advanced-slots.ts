import {
  DEVELOPMENT_PRIORITY_WEIGHTS,
  DEVELOPMENT_PROFILES
} from "../playerDevelopment/profiles.js";
import type { DevelopmentProfile, DevelopmentSkill } from "../playerDevelopment/types.js";

import {
  calculateDevelopmentReturnScoreBreakdown,
  calculateWeeklyTrainingPointsByKind,
  detectSkillUps,
  getTrainingWeeks,
  isSkillTrainableForPosition
} from "./index.js";
import {
  ADVANCED_SLOT_HIGH_DEVELOPMENT_POTENTIAL_THRESHOLD,
  ADVANCED_SLOT_MAX_TRIALS,
  ADVANCED_SLOT_TRIAL_MIN_PROFILE_QUALITY,
  ADVANCED_SLOT_REPLACEMENT_THRESHOLD,
  ADVANCED_SLOT_TRIAL_REPLACEMENT_THRESHOLD,
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
  PlayerSkill,
  TrainingOptionScoreBreakdown
} from "./types.js";

const TRIAL_PROFILE_BY_POSITION: Readonly<
  Record<NonNullable<TrainingRecommendationPlayer["position"]>, DevelopmentProfile>
> = {
  goalkeeper: "goalkeeper",
  defender: "defender",
  midfielder: "midfielder",
  winger: "winger",
  striker: "forward"
};

const TRAINING_SKILL_BY_DEVELOPMENT_SKILL: Readonly<Record<DevelopmentSkill, PlayerSkill>> = {
  stamina: "stamina",
  keeper: "keeper",
  pace: "pace",
  technique: "technique",
  passing: "passing",
  defender: "defending",
  playmaker: "playmaking",
  striker: "striker"
};

export function optimizeAdvancedTrainingSlots(
  contexts: readonly AdvancedTrainingCandidateContext[],
  gameWeek?: number
): AdvancedTrainingOptimization {
  const resolvedGameWeek = gameWeek ?? latestGameWeek(contexts);
  const candidates = contexts.map((context) => evaluateCandidate(context, resolvedGameWeek));
  const eligible = candidates.filter((candidate) => candidate.isEligible);
  const ranking = buildRanking(eligible);
  const idealIds = eligible
    .filter((candidate) => !candidate.isTrial && candidate.evaluation.advancedScore !== null)
    .sort(compareCandidates)
    .slice(0, ADVANCED_TRAINING_SLOT_COUNT)
    .map((candidate) => candidate.evaluation.playerId);
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
    (recommendation) =>
      recommendation.status === "promote_to_advanced" || recommendation.status === "trial_advanced"
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
  trialProfileQuality?: number | null;
  advancedScore?: number | null;
}): AdvancedSlotEvaluation["scoreBreakdown"] | null {
  const baseScore = calculateAdvancedSlotScore(input);
  if (baseScore === null) {
    return null;
  }

  return {
    marginalTrainingGain: input.marginalTrainingPoints / MAX_EFFICIENCY,
    developmentPotential: input.developmentPotentialScore,
    ...(input.trialProfileQuality !== null && input.trialProfileQuality !== undefined
      ? { profileQuality: input.trialProfileQuality }
      : {}),
    talentContribution: input.optionBreakdown?.talent,
    ageContribution: input.optionBreakdown ? 1 / input.optionBreakdown.ageCostFactor : 1,
    finalScore: input.advancedScore ?? baseScore
  };
}

interface EvaluatedCandidate {
  context: AdvancedTrainingCandidateContext;
  evaluation: AdvancedSlotEvaluation;
  isEligible: boolean;
  trialProfileQuality: number | null;
  currentlyAdvanced: boolean;
  confidence: TrainingRecommendationConfidence;
  isTrial: boolean;
}

function evaluateCandidate(
  context: AdvancedTrainingCandidateContext,
  gameWeek: number
): EvaluatedCandidate {
  const currentTraining = context.currentTraining;
  const history = historyForPlayer(context.trainingHistory, context.player.playerId);
  const isTrial = validSeniorTrainingWeekCount(history) < 2 && context.trial !== undefined;
  const trialProfileQuality = isTrial ? calculateTrialProfileQuality(context) : null;
  const isEligible = isTrial
    ? isEligibleForTrial(context, trialProfileQuality)
    : isEligibleForAdvancedTraining(context.player, currentTraining);
  const currentlyAdvanced = currentTraining.kind === "advanced";
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
        trialProfileQuality,
        confidence
      },
      isEligible,
      currentlyAdvanced,
      confidence,
      isTrial,
      trialProfileQuality
    };
  }

  const projectedIntensity = isTrial
    ? context.trial!.projectedIntensity
    : currentTraining.intensity;
  const calculatedAdvancedTrainingPoints = calculateWeeklyTrainingPointsByKind({
    intensity: projectedIntensity,
    kind: "advanced"
  });
  const calculatedFormationTrainingPoints = calculateWeeklyTrainingPointsByKind({
    intensity: isTrial ? projectedIntensity : currentTraining.intensity,
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
          talent: isTrial
            ? (context.trial?.academyTalent ?? null)
            : (context.talent?.value ?? null),
          skill: preferredSkill,
          currentSkillLevel: preferredLevel,
          expectedWeeklyTrainingPoints: expectedAdvancedTrainingPoints
        });
  const developmentPotentialScore = developmentPotentialBreakdown?.developmentReturnScore ?? null;
  const baseAdvancedScore =
    developmentPotentialScore === null || marginalTrainingPoints === null
      ? null
      : calculateAdvancedSlotScore({ marginalTrainingPoints, developmentPotentialScore });
  const advancedScore = isTrial
    ? calculateTrialAdvancedScore(baseAdvancedScore, trialProfileQuality)
    : baseAdvancedScore;
  const scoreBreakdown =
    developmentPotentialScore === null || marginalTrainingPoints === null
      ? null
      : buildAdvancedScoreBreakdown({
          marginalTrainingPoints,
          developmentPotentialScore,
          optionBreakdown: developmentPotentialBreakdown,
          trialProfileQuality,
          advancedScore
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
      trialProfileQuality,
      ...(scoreBreakdown ? { scoreBreakdown } : {}),
      confidence
    },
    isEligible,
    currentlyAdvanced,
    confidence,
    isTrial,
    trialProfileQuality
  };
}

function isEligibleForTrial(
  context: AdvancedTrainingCandidateContext,
  profileQuality: number | null
): boolean {
  const trial = context.trial;
  const skill = preferredSkillFor(context);
  return (
    trial !== undefined &&
    Number.isFinite(trial.projectedIntensity) &&
    trial.projectedIntensity > 0 &&
    trial.projectedIntensity <= MAX_EFFICIENCY &&
    Number.isInteger(context.player.playerId) &&
    context.player.playerId > 0 &&
    Number.isFinite(context.player.age) &&
    context.player.age >= BASE_TRAINING_AGE &&
    context.player.position !== null &&
    isSkillTrainableForPosition(context.player.position, skill) &&
    levelForPreferredSkill(context, skill) !== null &&
    profileQuality !== null &&
    profileQuality >= ADVANCED_SLOT_TRIAL_MIN_PROFILE_QUALITY
  );
}

function calculateTrialProfileQuality(context: AdvancedTrainingCandidateContext): number | null {
  const position = context.player.position;
  if (position === null) {
    return null;
  }

  const profile = TRIAL_PROFILE_BY_POSITION[position];
  const definition = DEVELOPMENT_PROFILES[profile];
  const totalWeight = definition.relevantSkills.reduce(
    (total, skill) => total + DEVELOPMENT_PRIORITY_WEIGHTS[skill.priority],
    0
  );
  if (totalWeight <= 0) {
    return null;
  }

  let weightedQuality = 0;
  for (const targetSkill of definition.relevantSkills) {
    const trainingSkill = TRAINING_SKILL_BY_DEVELOPMENT_SKILL[targetSkill.skill];
    const level = context.player.skills[trainingSkill];
    if (level === undefined || !Number.isInteger(level) || level < 0 || level > MAX_SKILL_LEVEL) {
      return null;
    }

    const weight = DEVELOPMENT_PRIORITY_WEIGHTS[targetSkill.priority];
    weightedQuality += Math.min(level / targetSkill.defaultTargetLevel, 1) * weight;
  }

  return weightedQuality / totalWeight;
}

function calculateTrialAdvancedScore(
  advancedScore: number | null,
  profileQuality: number | null
): number | null {
  if (advancedScore === null || profileQuality === null) {
    return null;
  }

  return (advancedScore + profileQuality) / 2;
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
  if (!isEligible || !history) {
    return "low";
  }

  const validWeekCount = validSeniorTrainingWeekCount(history);
  if (validWeekCount < 2) {
    return validWeekCount === 1 && context.trial !== undefined ? "medium" : "low";
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

function validSeniorTrainingWeekCount(history: TrainingHistory | null): number {
  if (!history) {
    return 0;
  }

  return history.weeks.filter(
    (week) =>
      (week.kind === "advanced" || week.kind === "formation") &&
      week.intensity !== undefined &&
      week.intensity > 0
  ).length;
}

function buildRanking(candidates: readonly EvaluatedCandidate[]): AdvancedTrainingRankingEntry[] {
  return [...candidates].sort(compareCandidates).map((candidate, index) => ({
    playerId: candidate.evaluation.playerId,
    rank: index + 1,
    score: candidate.evaluation.advancedScore,
    currentlyAdvanced: candidate.currentlyAdvanced,
    isTrial: candidate.isTrial,
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
    .filter((candidate) => candidate.currentlyAdvanced && !candidate.isTrial)
    .sort(compareCandidates)
    .slice(0, ADVANCED_TRAINING_SLOT_COUNT)
    .map((candidate) => candidate.evaluation.playerId);
  const idealIdSet = new Set(idealIds);
  const operationalCandidates = eligible
    .filter(
      (candidate) =>
        !candidate.currentlyAdvanced &&
        !candidate.isTrial &&
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

  const trialCandidates = eligible
    .filter((candidate) => candidate.isTrial)
    .sort(compareCandidates)
    .slice(0, ADVANCED_SLOT_MAX_TRIALS);
  const trial = trialCandidates[0];
  if (trial?.currentlyAdvanced) {
    if (selected.length >= ADVANCED_TRAINING_SLOT_COUNT) {
      const weakest = selected
        .map((id) => candidates.find((candidate) => candidate.evaluation.playerId === id))
        .filter((candidate): candidate is EvaluatedCandidate => candidate !== undefined)
        .sort(compareCandidates)
        .at(-1);
      if (weakest) {
        selected[selected.indexOf(weakest.evaluation.playerId)] = trial.evaluation.playerId;
      }
    } else {
      selected.push(trial.evaluation.playerId);
    }
  } else if (trial && selected.length < ADVANCED_TRAINING_SLOT_COUNT) {
    selected.push(trial.evaluation.playerId);
  } else if (trial) {
    const weakest = selected
      .map((id) => candidates.find((candidate) => candidate.evaluation.playerId === id))
      .filter((candidate): candidate is EvaluatedCandidate => candidate !== undefined)
      .sort(compareCandidates)
      .at(-1);
    if (
      weakest &&
      trial.evaluation.advancedScore !== null &&
      weakest.evaluation.advancedScore !== null &&
      trial.evaluation.advancedScore - weakest.evaluation.advancedScore >
        ADVANCED_SLOT_TRIAL_REPLACEMENT_THRESHOLD
    ) {
      selected[selected.indexOf(weakest.evaluation.playerId)] = trial.evaluation.playerId;
    }
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
      (!promote.isTrial && promote.confidence === "low") ||
      (!promote.isTrial && remove.confidence === "low") ||
      promote.evaluation.advancedScore === null ||
      remove.evaluation.advancedScore === null
    ) {
      continue;
    }

    const scoreDifference = promote.evaluation.advancedScore - remove.evaluation.advancedScore;
    const replacementThreshold = promote.isTrial
      ? ADVANCED_SLOT_TRIAL_REPLACEMENT_THRESHOLD
      : ADVANCED_SLOT_REPLACEMENT_THRESHOLD;
    if (scoreDifference <= replacementThreshold) {
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
  const reasons = reasonsForCandidate(candidate, recommendedAdvanced, rank, ranking, replacement);
  let status: AdvancedTrainingRecommendation;

  if (!candidate.isEligible || (!candidate.isTrial && candidate.confidence === "low")) {
    status = "hold";
  } else if (candidate.isTrial && recommendedAdvanced) {
    status = "trial_advanced";
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
  ranking: readonly AdvancedTrainingRankingEntry[],
  replacement: AdvancedSlotReplacement | undefined
): AdvancedSlotReason[] {
  if (!candidate.isEligible || candidate.evaluation.advancedScore === null) {
    if (
      candidate.isTrial &&
      candidate.trialProfileQuality !== null &&
      candidate.trialProfileQuality < ADVANCED_SLOT_TRIAL_MIN_PROFILE_QUALITY
    ) {
      return [
        {
          type: "trial_profile_not_viable",
          value: candidate.trialProfileQuality,
          threshold: ADVANCED_SLOT_TRIAL_MIN_PROFILE_QUALITY
        }
      ];
    }

    return [{ type: "insufficient_data" }];
  }

  const reasons: AdvancedSlotReason[] = [];
  const evaluation = candidate.evaluation;
  if (candidate.isTrial) {
    reasons.push(
      { type: "new_player_trial_candidate" },
      { type: "insufficient_senior_training_evidence" }
    );
    if (candidate.trialProfileQuality !== null) {
      reasons.push({ type: "trial_profile_viable", value: candidate.trialProfileQuality });
    }
    if (
      candidate.context.trial?.academyTalent !== null &&
      candidate.context.trial?.academyTalent !== undefined
    )
      reasons.push({ type: "academy_talent_signal", value: candidate.context.trial.academyTalent });
    if (evaluation.advancedScore !== null)
      reasons.push({ type: "projected_advanced_return", value: evaluation.advancedScore });
    const anotherTrialIsRecommended = ranking.some(
      (entry) =>
        entry.playerId !== candidate.evaluation.playerId &&
        entry.isTrial &&
        entry.recommendedAdvanced
    );
    if (!recommendedAdvanced && anotherTrialIsRecommended) {
      reasons.push({ type: "trial_slot_limit_reached" });
    }
  }
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
