import { WEEKS_PER_SOKKER_SEASON } from "../sokker/calendar.js";
import {
  calculateRequiredTrainingPoints,
  calculateWeeklyTrainingPointsByKind
} from "../training/index.js";
import { DEFAULT_TALENT_FOR_RELATIVE_COMPARISON, MAX_SKILL_LEVEL } from "../training/constants.js";
import type { Confidence } from "../types.js";
import { toTrainingDomainSkill, validateDevelopmentTarget } from "./training-path.js";
import type { PlayerTrainingPath } from "./training-path-types.js";
import type { DevelopmentSkill, PlayerDevelopmentTarget } from "./types.js";
import type {
  DevelopmentCurrentSkillProgress,
  DevelopmentProjectionContext,
  DevelopmentProjectionMilestone,
  DevelopmentProjectionStep,
  DevelopmentProjectionStatus,
  DevelopmentProjectionWarning,
  DevelopmentTrainingAssumptions,
  PlayerDevelopmentProjection
} from "./projection-types.js";

export const MAX_DEVELOPMENT_PROJECTION_WEEKS = 520;
export const DEVELOPMENT_PROJECTION_LONG_TERM_WEEKS = 26;
export const DEVELOPMENT_PROJECTION_MEDIUM_TERM_WEEKS = 8;
export const DEVELOPMENT_PROJECTION_WEEKS_PER_YEAR = WEEKS_PER_SOKKER_SEASON;
export const DEVELOPMENT_PROJECTION_DAYS_PER_WEEK = 7;
export const DEVELOPMENT_PROJECTION_DAYS_PER_YEAR = 365.25;

export const DEFAULT_DEVELOPMENT_TRAINING_ASSUMPTIONS: DevelopmentTrainingAssumptions = {
  trainingKind: "advanced",
  expectedIntensity: 100,
  assumeContinuousTraining: true
};

export function projectDevelopment(
  context: DevelopmentProjectionContext
): PlayerDevelopmentProjection {
  validateProjectionContext(context);

  const assumptions = context.trainingAssumptions ?? DEFAULT_DEVELOPMENT_TRAINING_ASSUMPTIONS;
  const warnings = new Set<DevelopmentProjectionWarning>();
  addAssumptionWarnings(warnings, assumptions, context.trainingAssumptions === undefined);

  if (!context.talent?.value || context.talent.value <= 0) {
    warnings.add("low_talent_confidence");
  } else if (context.talent.confidence === "low" || context.talent.confidence === "unknown") {
    warnings.add("low_talent_confidence");
  }

  const steps: DevelopmentProjectionStep[] = [];
  const milestones: DevelopmentProjectionMilestone[] = [];
  const state = createTimelineState(context);
  const maxProjectionWeeks = context.maxProjectionWeeks ?? MAX_DEVELOPMENT_PROJECTION_WEEKS;
  let projectionStatus: DevelopmentProjectionStatus = "projected";
  let firstStep = true;

  try {
    calculateWeeklyTrainingPointsByKind({
      intensity: assumptions.expectedIntensity,
      kind: assumptions.trainingKind
    });
  } catch {
    warnings.add("invalid_training_points");
    projectionStatus = "unavailable";
  }

  if (projectionStatus !== "unavailable") {
    const skillsWithProgressApplied = new Set<DevelopmentSkill>();

    for (const pathStep of context.path.steps) {
      if (
        !Number.isFinite(pathStep.estimatedTrainingPoints) ||
        pathStep.estimatedTrainingPoints < 0
      ) {
        warnings.add("invalid_training_points");
        projectionStatus = "unavailable";
        break;
      }
      if (!isValidPathStep(pathStep, context.target, state)) {
        warnings.add("path_incomplete");
        projectionStatus = "unavailable";
        break;
      }

      const usePartialProgress =
        !skillsWithProgressApplied.has(pathStep.skill) &&
        progressForSkill(context.currentTrainingProgress, pathStep.skill) !== null;

      const requiredTrainingPoints = calculateStepTrainingPoints({
        context,
        assumptions,
        state,
        skill: pathStep.skill,
        toLevel: pathStep.toLevel,
        usePartialProgress
      });

      if (usePartialProgress && requiredTrainingPoints !== null) {
        skillsWithProgressApplied.add(pathStep.skill);
      }

      if (requiredTrainingPoints === null) {
        warnings.add("invalid_training_points");
        projectionStatus = "unavailable";
        break;
      }

      if (firstStep && !hasKnownCurrentProgress(context.currentTrainingProgress, pathStep.skill)) {
        warnings.add("unknown_current_sublevel");
      }

      let expectedWeeklyPoints: number;
      if (
        context.expectedWeeklyTrainingPoints !== undefined &&
        context.expectedWeeklyTrainingPoints !== null &&
        Number.isFinite(context.expectedWeeklyTrainingPoints) &&
        context.expectedWeeklyTrainingPoints > 0
      ) {
        expectedWeeklyPoints = context.expectedWeeklyTrainingPoints;
      } else {
        try {
          expectedWeeklyPoints = calculateWeeklyTrainingPointsByKind({
            intensity: assumptions.expectedIntensity,
            kind: assumptions.trainingKind
          });
        } catch {
          expectedWeeklyPoints = Number.NaN;
        }
      }

      const estimatedWeeks =
        expectedWeeklyPoints > 0 && Number.isFinite(expectedWeeklyPoints)
          ? Math.ceil(requiredTrainingPoints / expectedWeeklyPoints)
          : Number.NaN;
      const nextCumulativeWeeks = state.elapsedWeeks + estimatedWeeks;

      if (
        !Number.isFinite(estimatedWeeks) ||
        estimatedWeeks < 0 ||
        !Number.isFinite(nextCumulativeWeeks)
      ) {
        warnings.add("invalid_training_points");
        projectionStatus = "unavailable";
        break;
      }

      if (nextCumulativeWeeks > maxProjectionWeeks) {
        warnings.add("projection_horizon_exceeded");
        projectionStatus = "partial";
        break;
      }

      const cumulativeWeeks = nextCumulativeWeeks;
      const estimatedDate = addWeeks(context.currentDate, cumulativeWeeks);
      const estimatedGameWeek = gameWeekAt(context.currentGameWeek, cumulativeWeeks);
      const estimatedAge = projectAge(context, estimatedDate, cumulativeWeeks);
      const confidence = calculateStepConfidence({
        context,
        cumulativeWeeks,
        firstStep,
        currentProgressKnown: hasKnownCurrentProgress(
          context.currentTrainingProgress,
          pathStep.skill
        ),
        currentProgressConfidence: progressForSkill(context.currentTrainingProgress, pathStep.skill)
          ?.confidence
      });

      steps.push({
        order: pathStep.order,
        skill: pathStep.skill,
        fromLevel: pathStep.fromLevel,
        toLevel: pathStep.toLevel,
        estimatedTrainingPoints: requiredTrainingPoints,
        estimatedWeeks,
        cumulativeWeeks,
        estimatedGameWeek,
        estimatedDate,
        estimatedAge,
        confidence
      });

      state.skills[pathStep.skill] = pathStep.toLevel;
      state.elapsedWeeks = cumulativeWeeks;
      state.estimatedDate = estimatedDate;
      state.estimatedGameWeek = estimatedGameWeek;
      state.estimatedAge = estimatedAge;
      addProjectionMilestones({
        path: context.path,
        step: pathStep.order,
        steps,
        milestones,
        confidence
      });

      if (cumulativeWeeks >= DEVELOPMENT_PROJECTION_LONG_TERM_WEEKS) {
        warnings.add("long_term_projection");
      }

      firstStep = false;
    }
  }

  const completed = isTargetComplete(context.target, state);
  if (projectionStatus === "projected" && (!completed || !context.path.completed)) {
    projectionStatus = "partial";
    if (!context.path.completed) {
      warnings.add("path_incomplete");
    }
  }

  if (completed && steps.length === 0) {
    milestones.push({
      type: "development_target_completed",
      step: 0,
      cumulativeWeeks: 0,
      estimatedGameWeek: context.currentGameWeek,
      estimatedDate: context.currentDate,
      estimatedAge: projectAge(context, context.currentDate, 0),
      confidence: "high"
    });
  }

  const completionWeeks =
    projectionStatus === "unavailable"
      ? null
      : projectionStatus === "partial" || !completed || !context.path.completed
        ? null
        : (steps.at(-1)?.cumulativeWeeks ?? 0);
  const completionGameWeek =
    projectionStatus === "unavailable"
      ? null
      : projectionStatus === "partial" || !completed || !context.path.completed
        ? null
        : (steps.at(-1)?.estimatedGameWeek ?? context.currentGameWeek);
  const completionDate =
    projectionStatus === "unavailable"
      ? null
      : projectionStatus === "partial" || !completed || !context.path.completed
        ? null
        : (steps.at(-1)?.estimatedDate ?? context.currentDate);
  const completionAge =
    projectionStatus === "unavailable"
      ? null
      : projectionStatus === "partial" || !completed || !context.path.completed
        ? null
        : (steps.at(-1)?.estimatedAge ?? (context.player.age ?? null));
  const completionConfidence = overallConfidence(context, steps, projectionStatus, completed);

  return {
    playerId: context.player.playerId,
    profile: context.target.profile,
    generatedAtGameWeek: context.currentGameWeek,
    generatedAtDate: context.currentDate,
    steps,
    milestones,
    completion: {
      estimatedWeeks: completionWeeks,
      estimatedGameWeek: completionGameWeek,
      estimatedDate: completionDate,
      estimatedAge: completionAge
    },
    confidence: completionConfidence,
    projectionStatus,
    warnings: Array.from(warnings),
    assumptions
  };
}

function validateProjectionContext(context: DevelopmentProjectionContext): void {
  if (context.path.playerId !== context.player.playerId) {
    throw new Error("Training path playerId does not match the projection player.");
  }
  if (context.target.playerId !== context.player.playerId) {
    throw new Error("Target playerId does not match the projection player.");
  }
  validateDevelopmentTarget(context.target, context.player.playerId);
}

function addAssumptionWarnings(
  warnings: Set<DevelopmentProjectionWarning>,
  assumptions: DevelopmentTrainingAssumptions,
  wereDefaulted: boolean
): void {
  if (wereDefaulted || assumptions.trainingKind === "formation") {
    warnings.add("formation_training_assumed");
  } else if (assumptions.trainingKind === "advanced") {
    warnings.add("advanced_training_assumed");
  }

  if (wereDefaulted || assumptions.expectedIntensity !== 100) {
    warnings.add("intensity_assumed");
  }

  if (wereDefaulted || assumptions.assumeContinuousTraining === false) {
    warnings.add("continuous_training_not_assumed");
  }
}

function createTimelineState(context: DevelopmentProjectionContext): DevelopmentTimelineState {
  const initialSkills: Partial<Record<DevelopmentSkill, number>> = {};
  for (const targetSkill of context.target.targetSkills) {
    const value = context.player.skills[targetSkill.skill];
    initialSkills[targetSkill.skill] =
      typeof value === "number" && Number.isFinite(value) ? Math.max(value, 0) : 0;
  }

  return {
    elapsedWeeks: 0,
    estimatedDate: context.currentDate,
    estimatedGameWeek: context.currentGameWeek,
    estimatedAge: projectAge(context, context.currentDate, 0),
    skills: initialSkills
  };
}

interface DevelopmentTimelineState {
  elapsedWeeks: number;
  estimatedDate: Date;
  estimatedGameWeek: number;
  estimatedAge: number;
  skills: Partial<Record<DevelopmentSkill, number>>;
}

function calculateStepTrainingPoints(input: {
  context: DevelopmentProjectionContext;
  assumptions: DevelopmentTrainingAssumptions;
  state: DevelopmentTimelineState;
  skill: DevelopmentSkill;
  toLevel: number;
  usePartialProgress: boolean;
}): number | null {
  if (!Number.isFinite(input.toLevel) || input.toLevel < 1 || input.toLevel > MAX_SKILL_LEVEL) {
    return null;
  }

  const talent = usableTalent(input.context);
  let fullLevelPoints: number;
  try {
    fullLevelPoints = calculateRequiredTrainingPoints({
      talent: talent ?? DEFAULT_TALENT_FOR_RELATIVE_COMPARISON,
      age: input.state.estimatedAge,
      skill: toTrainingDomainSkill(input.skill),
      targetSkillLevel: input.toLevel
    }).requiredTrainingPoints;
  } catch {
    return null;
  }

  if (!Number.isFinite(fullLevelPoints) || fullLevelPoints < 0) return null;

  if (input.usePartialProgress) {
    const progress = progressForSkill(input.context.currentTrainingProgress, input.skill);
    let remainingPoints: number | null = null;

    if (progress?.remainingToNextLevel !== undefined && progress.remainingToNextLevel !== null) {
      remainingPoints = validNonNegative(progress.remainingToNextLevel) ? progress.remainingToNextLevel : null;
    } else if (
      progress?.accumulatedPoints !== undefined &&
      progress.accumulatedPoints !== null &&
      Number.isFinite(progress.accumulatedPoints) &&
      progress.accumulatedPoints >= 0
    ) {
      remainingPoints = Math.max(0, fullLevelPoints - progress.accumulatedPoints);
    } else if (
      progress?.estimatedProgress !== undefined &&
      progress.estimatedProgress !== null &&
      Number.isFinite(progress.estimatedProgress) &&
      progress.estimatedProgress >= 0 &&
      progress.estimatedProgress <= 1
    ) {
      remainingPoints = Math.max(0, fullLevelPoints * (1 - progress.estimatedProgress));
    }

    if (remainingPoints !== null) {
      if (remainingPoints <= 0) {
        let expectedWeeklyPoints: number;
        try {
          expectedWeeklyPoints = calculateWeeklyTrainingPointsByKind({
            intensity: input.assumptions.expectedIntensity,
            kind: input.assumptions.trainingKind
          });
        } catch {
          expectedWeeklyPoints = 100;
        }
        return expectedWeeklyPoints > 0 ? expectedWeeklyPoints : 1;
      }
      return remainingPoints;
    }
  }

  return fullLevelPoints;
}

function isValidPathStep(
  pathStep: PlayerTrainingPath["steps"][number],
  target: PlayerDevelopmentTarget,
  state: DevelopmentTimelineState
): boolean {
  const targetSkill = target.targetSkills.find((skill) => skill.skill === pathStep.skill);
  const currentLevel = state.skills[pathStep.skill] ?? 0;

  return (
    targetSkill !== undefined &&
    Number.isFinite(pathStep.estimatedTrainingPoints) &&
    pathStep.estimatedTrainingPoints >= 0 &&
    pathStep.fromLevel === currentLevel &&
    pathStep.toLevel === pathStep.fromLevel + 1 &&
    pathStep.toLevel <= targetSkill.targetLevel
  );
}

function addProjectionMilestones(input: {
  path: PlayerTrainingPath;
  step: number;
  steps: DevelopmentProjectionStep[];
  milestones: DevelopmentProjectionMilestone[];
  confidence: Confidence;
}): void {
  const pathMilestones = input.path.milestones.filter((milestone) => milestone.step === input.step);
  const projectionStep = input.steps.at(-1);
  if (!projectionStep) return;

  for (const pathMilestone of pathMilestones) {
    input.milestones.push({
      type: pathMilestone.type,
      skill: pathMilestone.skill,
      step: pathMilestone.step,
      cumulativeWeeks: projectionStep.cumulativeWeeks ?? 0,
      estimatedGameWeek: projectionStep.estimatedGameWeek ?? 0,
      estimatedDate: projectionStep.estimatedDate,
      estimatedAge: projectionStep.estimatedAge,
      confidence: input.confidence
    });
  }
}

function calculateStepConfidence(input: {
  context: DevelopmentProjectionContext;
  cumulativeWeeks: number;
  firstStep: boolean;
  currentProgressKnown: boolean;
  currentProgressConfidence?: Confidence;
}): Confidence {
  let confidence: Confidence = "high";

  if (input.context.talent?.confidence === "medium") confidence = "medium";
  if (input.context.talent?.confidence === "low" || input.context.talent?.confidence === "unknown") {
    confidence = "low";
  }

  if (input.firstStep && !input.currentProgressKnown) {
    confidence = minimumConfidence(confidence, "low");
  }

  if (input.firstStep && input.currentProgressConfidence) {
    confidence = minimumConfidence(confidence, input.currentProgressConfidence);
  }

  if (input.cumulativeWeeks >= DEVELOPMENT_PROJECTION_LONG_TERM_WEEKS) {
    confidence = minimumConfidence(confidence, "low");
  } else if (input.cumulativeWeeks >= DEVELOPMENT_PROJECTION_MEDIUM_TERM_WEEKS) {
    confidence = minimumConfidence(confidence, "medium");
  }

  return confidence;
}

function overallConfidence(
  context: DevelopmentProjectionContext,
  steps: DevelopmentProjectionStep[],
  status: DevelopmentProjectionStatus,
  completed: boolean
): Confidence {
  if (steps.length === 0) return "low";

  let confidence = steps.reduce(
    (min, step) => minimumConfidence(min, step.confidence),
    "high" as Confidence
  );

  if (!context.talent?.value || context.talent.confidence === "low") {
    confidence = minimumConfidence(confidence, "low");
  }

  if (status !== "projected" || !completed) confidence = minimumConfidence(confidence, "low");

  return confidence;
}

function progressForSkill(
  progress: DevelopmentCurrentSkillProgress | undefined,
  skill: DevelopmentSkill
): DevelopmentCurrentSkillProgress | null {
  if (!progress || normalizeProgressSkill(progress.skill) !== skill) return null;
  return progress;
}

function hasKnownCurrentProgress(
  progress: DevelopmentCurrentSkillProgress | undefined,
  skill: DevelopmentSkill
): boolean {
  const currentProgress = progressForSkill(progress, skill);
  return (
    (currentProgress?.remainingToNextLevel !== undefined &&
      currentProgress.remainingToNextLevel !== null &&
      validNonNegative(currentProgress.remainingToNextLevel)) ||
    (currentProgress?.accumulatedPoints !== undefined &&
      currentProgress.accumulatedPoints !== null &&
      validNonNegative(currentProgress.accumulatedPoints)) ||
    (currentProgress?.estimatedProgress !== undefined &&
      currentProgress.estimatedProgress !== null &&
      Number.isFinite(currentProgress.estimatedProgress) &&
      currentProgress.estimatedProgress >= 0 &&
      currentProgress.estimatedProgress <= 1)
  );
}

function normalizeProgressSkill(skill: DevelopmentCurrentSkillProgress["skill"]): DevelopmentSkill {
  if (skill === "defending") return "defender";
  if (skill === "playmaking") return "playmaker";
  if (skill === "scoring") return "striker";
  return skill;
}

function usableTalent(context: DevelopmentProjectionContext): number | null {
  const talent = context.talent?.value;
  return typeof talent === "number" && validPositive(talent) ? talent : null;
}

function projectAge(
  context: DevelopmentProjectionContext,
  _date: Date,
  elapsedWeeks: number
): number {
  const baseAge = context.player.age ?? 18;
  return baseAge + elapsedWeeks / DEVELOPMENT_PROJECTION_WEEKS_PER_YEAR;
}

function addWeeks(date: Date, weeks: number): Date {
  return new Date(
    date.getTime() + weeks * DEVELOPMENT_PROJECTION_DAYS_PER_WEEK * 24 * 60 * 60 * 1000
  );
}

function gameWeekAt(currentGameWeek: number, elapsedWeeks: number): number {
  return Math.max(currentGameWeek, Math.round(currentGameWeek + elapsedWeeks));
}

function isTargetComplete(
  target: PlayerDevelopmentTarget,
  state: DevelopmentTimelineState
): boolean {
  return (
    target.targetSkills.length > 0 &&
    target.targetSkills.every((skill) => (state.skills[skill.skill] ?? 0) >= skill.targetLevel)
  );
}

function minimumConfidence(left: Confidence, right: Confidence): Confidence {
  const rank: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
  return rank[left] <= rank[right] ? left : right;
}

function validNonNegative(value: number | null | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function validPositive(value: number | null | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
