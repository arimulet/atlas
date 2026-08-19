import {
  calculateDevelopmentReturnScore,
  calculateRequiredTrainingPoints,
  calculateWeeklyTrainingPoints,
  detectSkillUps,
  getTrainingWeeks
} from "./index.js";
import {
  MAX_SKILL_LEVEL,
  TRAINING_RECOMMENDATION_HIGH_NEXT_LEVEL_WEEKS,
  TRAINING_RECOMMENDATION_MIN_HISTORY_WEEKS,
  TRAINING_RECOMMENDATION_RECENT_SWITCH_THRESHOLD,
  TRAINING_RECOMMENDATION_SKILL_UP_SOON_WEEKS,
  TRAINING_RECOMMENDATION_SWITCH_THRESHOLD
} from "./constants.js";
import type {
  PlayerTrainingRecommendation,
  PlayerTrainingRecommendationContext,
  SkillTrainingCostSkill,
  TrainingHistory,
  TrainingOptionEvaluation,
  TrainingRecommendationConfidence,
  TrainingRecommendationReason,
  TrainingRecommendationPlayer
} from "./types.js";

const TRAINABLE_SKILLS_BY_POSITION: Readonly<
  Record<NonNullable<TrainingRecommendationPlayer["position"]>, readonly SkillTrainingCostSkill[]>
> = {
  goalkeeper: ["keeper", "pace", "passing"],
  defender: ["defending", "pace", "technique", "passing"],
  midfielder: ["playmaking", "passing", "technique", "pace"],
  winger: ["pace", "technique", "passing", "playmaking"],
  striker: ["scoring", "pace", "technique"]
};

export function buildTrainingRecommendations(
  contexts: readonly PlayerTrainingRecommendationContext[]
): PlayerTrainingRecommendation[] {
  return contexts.map(buildTrainingRecommendation);
}

export function buildTrainingRecommendation(
  context: PlayerTrainingRecommendationContext
): PlayerTrainingRecommendation {
  const history = historyForPlayer(context.trainingHistory, context.player.playerId);
  const currentSkill = context.weeklyReport.training.skill;
  const expectedWeeklyTrainingPoints = calculateWeeklyTrainingPoints(
    context.weeklyReport.training.intensity
  );
  const talent = context.talent?.value ?? null;
  const currentOption = evaluateOption({
    age: context.player.age,
    currentSkill,
    currentLevel: context.weeklyReport.skill.currentLevel,
    expectedWeeklyTrainingPoints,
    talent
  });
  const alternatives = alternativeSkills(context.player, currentSkill).flatMap((skill) => {
    const currentLevel = levelForSkill(context.player.skills, skill);
    if (currentLevel === null) {
      return [];
    }

    return [
      evaluateOption({
        age: context.player.age,
        currentSkill: skill,
        currentLevel,
        expectedWeeklyTrainingPoints,
        talent
      })
    ];
  });
  const confidence = recommendationConfidence({
    history,
    currentSkill,
    talent: context.talent,
    weeklyReport: context.weeklyReport
  });
  const common = {
    playerId: context.player.playerId,
    currentSkill,
    currentOption,
    alternatives,
    confidence
  };

  if (!history || history.weeks.length < TRAINING_RECOMMENDATION_MIN_HISTORY_WEEKS) {
    return {
      ...common,
      status: "hold",
      reasons: [{ type: "insufficient_history" }]
    };
  }

  const hasKnownSkillUp = detectSkillUps(history).some((skillUp) => skillUp.skill === currentSkill);
  if (!hasKnownSkillUp && talent === null) {
    return {
      ...common,
      status: "hold",
      reasons: [{ type: "insufficient_history" }, { type: "talent_uncertain" }]
    };
  }

  if (currentOption.developmentReturnScore === null) {
    return {
      ...common,
      status: "hold",
      reasons: [
        { type: "current_option_not_calculable" },
        ...(talent === null ? [{ type: "talent_uncertain" as const }] : [])
      ]
    };
  }

  const validAlternatives = alternatives.filter(
    (alternative) => alternative.developmentReturnScore !== null
  );
  if (validAlternatives.length === 0) {
    return {
      ...common,
      status: "hold",
      reasons: [{ type: "no_valid_alternative" }]
    };
  }

  const bestAlternative = [...validAlternatives].sort(compareOptions)[0];
  if (!bestAlternative || bestAlternative.developmentReturnScore === null) {
    return {
      ...common,
      status: "hold",
      reasons: [{ type: "no_valid_alternative" }]
    };
  }

  const recentlyChangedSkill = hasRecentlyChangedTrainingSkill(
    history,
    currentSkill,
    context.weeklyReport.gameWeek
  );
  const switchThreshold = recentlyChangedSkill
    ? TRAINING_RECOMMENDATION_RECENT_SWITCH_THRESHOLD
    : TRAINING_RECOMMENDATION_SWITCH_THRESHOLD;
  const scoreImprovement =
    bestAlternative.developmentReturnScore - currentOption.developmentReturnScore;
  const shouldSwitch =
    bestAlternative.developmentReturnScore > currentOption.developmentReturnScore * switchThreshold;

  if (!shouldSwitch) {
    return {
      ...common,
      status: "continue",
      reasons: [
        ...continueReasons(context.weeklyReport, currentOption),
        ...(talent === null ? [{ type: "talent_uncertain" as const }] : [])
      ]
    };
  }

  return {
    ...common,
    status: "switch_skill",
    recommendedSkill: bestAlternative.skill,
    reasons: [
      ...switchReasons({
        currentOption,
        currentSkill,
        alternative: bestAlternative,
        improvement: scoreImprovement,
        weeklyReport: context.weeklyReport
      }),
      ...(talent === null ? [{ type: "talent_uncertain" as const }] : [])
    ]
  };
}

export function evaluateTrainingOption(input: {
  age: number;
  skill: SkillTrainingCostSkill;
  currentLevel: number;
  expectedWeeklyTrainingPoints: number;
  talent?: number | null;
}): TrainingOptionEvaluation {
  return evaluateOption({
    age: input.age,
    currentSkill: input.skill,
    currentLevel: input.currentLevel,
    expectedWeeklyTrainingPoints: input.expectedWeeklyTrainingPoints,
    talent: input.talent ?? null
  });
}

function evaluateOption(input: {
  age: number;
  currentSkill: SkillTrainingCostSkill;
  currentLevel: number;
  expectedWeeklyTrainingPoints: number;
  talent: number | null;
}): TrainingOptionEvaluation {
  const expectedWeeklyTrainingPoints =
    input.expectedWeeklyTrainingPoints > 0 ? input.expectedWeeklyTrainingPoints : null;
  const requiredTrainingPoints =
    input.talent === null || input.currentLevel >= MAX_SKILL_LEVEL
      ? null
      : calculateRequiredTrainingPoints({
          talent: input.talent,
          age: input.age,
          skill: input.currentSkill,
          targetSkillLevel: input.currentLevel + 1
        }).requiredTrainingPoints;
  const estimatedWeeksToNextLevel =
    requiredTrainingPoints === null || expectedWeeklyTrainingPoints === null
      ? null
      : requiredTrainingPoints / expectedWeeklyTrainingPoints;

  return {
    skill: input.currentSkill,
    currentLevel: input.currentLevel,
    estimatedWeeksToNextLevel,
    requiredTrainingPoints,
    expectedWeeklyTrainingPoints,
    developmentReturnScore: calculateDevelopmentReturnScore({
      age: input.age,
      talent: input.talent,
      skill: input.currentSkill,
      currentSkillLevel: input.currentLevel,
      expectedWeeklyTrainingPoints: input.expectedWeeklyTrainingPoints
    })
  };
}

function alternativeSkills(
  player: TrainingRecommendationPlayer,
  currentSkill: SkillTrainingCostSkill
): SkillTrainingCostSkill[] {
  const candidates = player.position
    ? TRAINABLE_SKILLS_BY_POSITION[player.position]
    : (["pace", "technique", "passing", "playmaking"] as const);

  return candidates.filter((skill) => skill !== currentSkill);
}

function levelForSkill(
  skills: TrainingRecommendationPlayer["skills"],
  skill: SkillTrainingCostSkill
): number | null {
  const playerSkill = skill === "scoring" ? "striker" : skill;
  const level = skills[playerSkill];
  return level !== undefined && Number.isInteger(level) && level >= 0 && level <= MAX_SKILL_LEVEL
    ? level
    : null;
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

function recommendationConfidence(input: {
  history: TrainingHistory | null;
  currentSkill: SkillTrainingCostSkill;
  talent: PlayerTrainingRecommendationContext["talent"];
  weeklyReport: PlayerTrainingRecommendationContext["weeklyReport"];
}): TrainingRecommendationConfidence {
  if (!input.history || input.history.weeks.length < TRAINING_RECOMMENDATION_MIN_HISTORY_WEEKS) {
    return "low";
  }

  const skillUpCount = detectSkillUps(input.history).filter(
    (skillUp) => skillUp.skill === input.currentSkill
  ).length;
  const talentIsStable = input.talent?.value !== null && input.talent?.value !== undefined;
  if (talentIsStable && input.talent?.confidence === "high" && skillUpCount > 0) {
    return "high";
  }

  if (skillUpCount > 0 || talentIsStable || input.weeklyReport.trainingPoints.earned > 0) {
    return "medium";
  }

  return "low";
}

function hasRecentlyChangedTrainingSkill(
  history: TrainingHistory,
  currentSkill: SkillTrainingCostSkill,
  gameWeek: number
): boolean {
  const weeks = getTrainingWeeks(history);
  const currentWeek = weeks.find((week) => week.week === gameWeek);
  const previousWeek = weeks
    .filter((week) => week.week < gameWeek && week.kind !== "missing")
    .at(-1);

  return (
    previousWeek !== undefined &&
    currentWeek?.skill !== previousWeek.skill &&
    currentWeek?.skill === currentSkill
  );
}

function continueReasons(
  report: PlayerTrainingRecommendationContext["weeklyReport"],
  currentOption: TrainingOptionEvaluation
): TrainingRecommendationReason[] {
  const reasons: TrainingRecommendationReason[] = [];

  if (report.skill.skillUp) {
    reasons.push({ type: "recent_skill_up", skill: report.training.skill });
  }

  if (
    currentOption.estimatedWeeksToNextLevel !== null &&
    currentOption.estimatedWeeksToNextLevel <= TRAINING_RECOMMENDATION_SKILL_UP_SOON_WEEKS
  ) {
    reasons.push({
      type: "skill_up_soon",
      estimatedWeeks: currentOption.estimatedWeeksToNextLevel
    });
  }

  if (reasons.length === 0) {
    reasons.push({ type: "stable_current_skill", skill: report.training.skill });
  }

  return reasons;
}

function switchReasons(input: {
  currentOption: TrainingOptionEvaluation;
  currentSkill: SkillTrainingCostSkill;
  alternative: TrainingOptionEvaluation;
  improvement: number;
  weeklyReport: PlayerTrainingRecommendationContext["weeklyReport"];
}): TrainingRecommendationReason[] {
  const reasons: TrainingRecommendationReason[] = [
    {
      type: "better_alternative",
      currentSkill: input.currentSkill,
      alternativeSkill: input.alternative.skill,
      improvement: input.improvement
    }
  ];

  if (input.weeklyReport.skill.skillUp) {
    reasons.push({ type: "recent_skill_up", skill: input.currentSkill });
  }

  if (
    input.currentOption.estimatedWeeksToNextLevel !== null &&
    input.currentOption.estimatedWeeksToNextLevel >= TRAINING_RECOMMENDATION_HIGH_NEXT_LEVEL_WEEKS
  ) {
    reasons.push({ type: "high_next_level_cost", skill: input.currentSkill });
  }

  return reasons;
}

function compareOptions(left: TrainingOptionEvaluation, right: TrainingOptionEvaluation): number {
  return (right.developmentReturnScore ?? -1) - (left.developmentReturnScore ?? -1);
}
