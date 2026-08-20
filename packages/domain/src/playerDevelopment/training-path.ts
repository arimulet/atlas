import {
  calculateDevelopmentReturnScoreBreakdown,
  calculateRequiredTrainingPoints,
  calculateWeeklyTrainingPoints
} from "../training/index.js";
import { DEFAULT_TALENT_FOR_RELATIVE_COMPARISON, MAX_SKILL_LEVEL } from "../training/constants.js";
import { DEVELOPMENT_PRIORITY_WEIGHTS, DEVELOPMENT_PROFILES } from "./profiles.js";
import type { DevelopmentPriority, DevelopmentSkill, PlayerDevelopmentTarget } from "./types.js";
import type {
  DevelopmentMilestone,
  DevelopmentSimulationState,
  PlayerTrainingPath,
  TrainingPathCandidate,
  TrainingPathContext,
  TrainingPathPlayer,
  TrainingPathReason,
  TrainingPathStep
} from "./training-path-types.js";
import type { SkillTrainingCostSkill } from "../training/types.js";

export const MAX_DEVELOPMENT_PATH_STEPS = 256;
export const DEVELOPMENT_PATH_TIE_EPSILON = 0.05;
export const DEVELOPMENT_PATH_LOW_COST_EPSILON = 0.1;
export const DEVELOPMENT_PATH_HIGH_RETURN_THRESHOLD = 0.5;
export const DEVELOPMENT_PATH_WEEKS_PER_YEAR = 52;
export const DEFAULT_DEVELOPMENT_PATH_WEEKLY_POINTS = 100;

const DEVELOPMENT_SKILL_ORDER: readonly DevelopmentSkill[] = [
  "stamina",
  "pace",
  "technique",
  "passing",
  "keeper",
  "defender",
  "playmaker",
  "striker"
];

const DEVELOPMENT_TO_TRAINING_SKILL: Readonly<Record<DevelopmentSkill, SkillTrainingCostSkill>> = {
  stamina: "stamina",
  pace: "pace",
  technique: "technique",
  passing: "passing",
  keeper: "keeper",
  defender: "defending",
  playmaker: "playmaking",
  striker: "scoring"
};

export function createDevelopmentSimulationState(
  context: TrainingPathContext
): DevelopmentSimulationState {
  validateDevelopmentTarget(context.target, context.player.playerId);

  const skills: Partial<Record<DevelopmentSkill, number>> = {};
  for (const targetSkill of context.target.targetSkills) {
    skills[targetSkill.skill] = currentSkillLevel(context.player, targetSkill.skill);
  }

  return {
    skills,
    accumulatedTrainingPoints: 0,
    stepsCompleted: 0,
    estimatedElapsedWeeks: 0,
    estimatedAge: context.player.age
  };
}

export function generateNextTrainingCandidates(
  context: TrainingPathContext,
  state: DevelopmentSimulationState = createDevelopmentSimulationState(context)
): TrainingPathCandidate[] {
  validateDevelopmentTarget(context.target, context.player.playerId);

  if (state.stepsCompleted >= MAX_DEVELOPMENT_PATH_STEPS) return [];

  const expectedWeeklyTrainingPoints = weeklyTrainingPoints(context);
  const talent = usableTalent(context);
  const candidates = context.target.targetSkills.flatMap((targetSkill) => {
    const fromLevel = state.skills[targetSkill.skill] ?? 0;
    const toLevel = fromLevel + 1;

    if (fromLevel >= targetSkill.targetLevel || toLevel > targetSkill.targetLevel) {
      return [];
    }

    const trainingSkill = DEVELOPMENT_TO_TRAINING_SKILL[targetSkill.skill];
    const requiredTrainingPoints = calculateRequiredTrainingPoints({
      talent: talent ?? DEFAULT_TALENT_FOR_RELATIVE_COMPARISON,
      age: state.estimatedAge,
      skill: trainingSkill,
      targetSkillLevel: toLevel
    }).requiredTrainingPoints;
    const breakdown = calculateDevelopmentReturnScoreBreakdown({
      age: state.estimatedAge,
      talent,
      skill: trainingSkill,
      currentSkillLevel: fromLevel,
      expectedWeeklyTrainingPoints
    });

    if (!breakdown || !isFinitePositive(requiredTrainingPoints)) return [];

    return [
      {
        skill: targetSkill.skill,
        fromLevel,
        toLevel,
        requiredTrainingPoints,
        expectedWeeklyTrainingPoints,
        estimatedWeeks: requiredTrainingPoints / expectedWeeklyTrainingPoints,
        estimatedAgeAtStep:
          state.estimatedAge +
          requiredTrainingPoints / expectedWeeklyTrainingPoints / DEVELOPMENT_PATH_WEEKS_PER_YEAR,
        targetPriority: targetSkill.priority,
        developmentReturnScore: breakdown.developmentReturnScore,
        developmentValue: breakdown.developmentValue,
        pathScore:
          DEVELOPMENT_PRIORITY_WEIGHTS[targetSkill.priority] * breakdown.developmentReturnScore,
        reason: baseReasons({
          skill: targetSkill.skill,
          priority: targetSkill.priority,
          toLevel,
          targetLevel: targetSkill.targetLevel,
          developmentReturnScore: breakdown.developmentReturnScore
        })
      }
    ];
  });

  const minimumCost = Math.min(...candidates.map((candidate) => candidate.requiredTrainingPoints));
  const profileCompletion = weightedProfileCompletion(context.target, state);

  return candidates.map((candidate) => ({
    ...candidate,
    reason: [
      ...candidate.reason,
      ...(candidate.requiredTrainingPoints <= minimumCost * (1 + DEVELOPMENT_PATH_LOW_COST_EPSILON)
        ? [{ type: "low_marginal_cost" as const, value: candidate.requiredTrainingPoints }]
        : []),
      ...(skillCompletion(context.target, state, candidate.skill) < profileCompletion
        ? [{ type: "balances_profile" as const, skill: candidate.skill }]
        : [])
    ]
  }));
}

export function selectBestTrainingCandidate(
  candidates: readonly TrainingPathCandidate[],
  previousSkill?: DevelopmentSkill
): TrainingPathCandidate | null {
  return (
    [...candidates].sort((left, right) => compareCandidates(left, right, previousSkill))[0] ?? null
  );
}

export function generatePlayerTrainingPath(context: TrainingPathContext): PlayerTrainingPath {
  validateDevelopmentTarget(context.target, context.player.playerId);

  const state = createDevelopmentSimulationState(context);
  const steps: TrainingPathStep[] = [];
  const milestones: DevelopmentMilestone[] = [];

  while (state.stepsCompleted < MAX_DEVELOPMENT_PATH_STEPS) {
    const candidates = generateNextTrainingCandidates(context, state);
    const candidate = selectBestTrainingCandidate(candidates, state.lastSkill);

    if (!candidate) break;

    steps.push({
      order: steps.length + 1,
      skill: candidate.skill,
      fromLevel: candidate.fromLevel,
      toLevel: candidate.toLevel,
      priority: candidate.targetPriority,
      estimatedTrainingPoints: candidate.requiredTrainingPoints,
      developmentValue: candidate.developmentValue,
      reason: candidate.reason
    });

    state.skills[candidate.skill] = candidate.toLevel;
    state.accumulatedTrainingPoints += candidate.requiredTrainingPoints;
    state.estimatedElapsedWeeks += candidate.estimatedWeeks;
    state.estimatedAge = candidate.estimatedAgeAtStep;
    state.stepsCompleted += 1;
    state.lastSkill = candidate.skill;

    addMilestones({ context, state, milestones, step: steps.length, skill: candidate.skill });
  }

  const completed = isTargetComplete(context.target, state);

  return {
    playerId: context.player.playerId,
    profile: context.target.profile,
    steps,
    milestones,
    totals: {
      skillUps: steps.length,
      estimatedTrainingPoints: state.accumulatedTrainingPoints
    },
    completed,
    confidence: pathConfidence(context, completed, steps.length > 0)
  };
}

export function getNextPlannedTrainingStep(path: PlayerTrainingPath): TrainingPathStep | null {
  return path.steps[0] ?? null;
}

export function validateDevelopmentTarget(
  target: PlayerDevelopmentTarget,
  playerId?: number
): void {
  if (playerId !== undefined && target.playerId !== playerId) {
    throw new Error("Development target playerId does not match the path player.");
  }

  if (!Object.hasOwn(DEVELOPMENT_PROFILES, target.profile)) {
    throw new Error(`Invalid development profile: ${String(target.profile)}.`);
  }

  const skills = new Set<DevelopmentSkill>();
  for (const targetSkill of target.targetSkills) {
    if (!DEVELOPMENT_SKILL_ORDER.includes(targetSkill.skill)) {
      throw new Error(`Invalid development target skill: ${String(targetSkill.skill)}.`);
    }
    if (skills.has(targetSkill.skill)) {
      throw new Error(`Development target contains duplicate skill: ${targetSkill.skill}.`);
    }
    if (
      !Number.isInteger(targetSkill.targetLevel) ||
      targetSkill.targetLevel < 0 ||
      targetSkill.targetLevel > MAX_SKILL_LEVEL
    ) {
      throw new Error(`Invalid target level for ${targetSkill.skill}.`);
    }
    skills.add(targetSkill.skill);
  }
}

function baseReasons(input: {
  skill: DevelopmentSkill;
  priority: DevelopmentPriority;
  toLevel: number;
  targetLevel: number;
  developmentReturnScore: number;
}): TrainingPathReason[] {
  return [
    ...(input.priority === "primary"
      ? [{ type: "primary_target_skill" as const, skill: input.skill }]
      : []),
    ...(input.developmentReturnScore >= DEVELOPMENT_PATH_HIGH_RETURN_THRESHOLD
      ? [{ type: "high_development_return" as const, value: input.developmentReturnScore }]
      : []),
    ...(input.toLevel === input.targetLevel
      ? [{ type: "completes_target_skill" as const, skill: input.skill }]
      : [])
  ];
}

function compareCandidates(
  left: TrainingPathCandidate,
  right: TrainingPathCandidate,
  previousSkill?: DevelopmentSkill
): number {
  if (Math.abs(left.pathScore - right.pathScore) > DEVELOPMENT_PATH_TIE_EPSILON) {
    return right.pathScore - left.pathScore;
  }

  const priorityDifference =
    DEVELOPMENT_PRIORITY_WEIGHTS[right.targetPriority] -
    DEVELOPMENT_PRIORITY_WEIGHTS[left.targetPriority];
  if (priorityDifference !== 0) return priorityDifference;

  const costDifference = left.requiredTrainingPoints - right.requiredTrainingPoints;
  if (Math.abs(costDifference) > DEVELOPMENT_PATH_TIE_EPSILON) return costDifference;

  if (previousSkill && left.skill !== right.skill) {
    if (left.skill === previousSkill) return -1;
    if (right.skill === previousSkill) return 1;
  }

  return skillOrder(left.skill) - skillOrder(right.skill);
}

function addMilestones(input: {
  context: TrainingPathContext;
  state: DevelopmentSimulationState;
  milestones: DevelopmentMilestone[];
  step: number;
  skill: DevelopmentSkill;
}): void {
  const targetSkill = input.context.target.targetSkills.find(
    (target) => target.skill === input.skill
  );
  if (targetSkill && (input.state.skills[input.skill] ?? 0) >= targetSkill.targetLevel) {
    input.milestones.push({ step: input.step, type: "skill_target_completed", skill: input.skill });
  }

  const primarySkills = input.context.target.targetSkills.filter(
    (target) => target.priority === "primary"
  );
  if (
    primarySkills.length > 0 &&
    primarySkills.every(
      (target) => (input.state.skills[target.skill] ?? 0) >= target.targetLevel
    ) &&
    !input.milestones.some((milestone) => milestone.type === "primary_skills_completed")
  ) {
    input.milestones.push({ step: input.step, type: "primary_skills_completed" });
  }

  if (
    isTargetComplete(input.context.target, input.state) &&
    !input.milestones.some((milestone) => milestone.type === "development_target_completed")
  ) {
    input.milestones.push({ step: input.step, type: "development_target_completed" });
  }
}

function pathConfidence(
  context: TrainingPathContext,
  completed: boolean,
  hasSteps: boolean
): "low" | "medium" | "high" {
  if (
    !completed ||
    (!hasSteps && !isTargetComplete(context.target, createDevelopmentSimulationState(context)))
  ) {
    return "low";
  }

  if (context.talent?.value !== null && context.talent?.value !== undefined) {
    if (context.talent.confidence === "high" && (context.trainingHistory?.length ?? 0) > 0) {
      return "high";
    }
    return "medium";
  }

  return "low";
}

function weeklyTrainingPoints(context: TrainingPathContext): number {
  if (isFinitePositive(context.expectedWeeklyTrainingPoints)) {
    return context.expectedWeeklyTrainingPoints;
  }

  const observedPoints = (context.trainingHistory ?? [])
    .flatMap((history) => history.weeks)
    .map((week) => week.trainingPoints)
    .filter(isFinitePositive);
  if (observedPoints.length > 0) {
    return observedPoints.reduce((total, points) => total + points, 0) / observedPoints.length;
  }

  return calculateWeeklyTrainingPoints(DEFAULT_DEVELOPMENT_PATH_WEEKLY_POINTS);
}

function usableTalent(context: TrainingPathContext): number | null {
  const value = context.talent?.value;
  return isFinitePositive(value) ? value : null;
}

function currentSkillLevel(player: TrainingPathPlayer, skill: DevelopmentSkill): number {
  const value = player.skills[skill];
  return typeof value === "number" && Number.isFinite(value) ? Math.max(value, 0) : 0;
}

function weightedProfileCompletion(
  target: PlayerDevelopmentTarget,
  state: DevelopmentSimulationState
): number {
  const totalWeight = target.targetSkills.reduce(
    (total, skill) => total + DEVELOPMENT_PRIORITY_WEIGHTS[skill.priority],
    0
  );
  if (totalWeight === 0) return 1;

  return (
    target.targetSkills.reduce((total, skill) => {
      const current = state.skills[skill.skill] ?? 0;
      const completion =
        skill.targetLevel > 0 ? Math.min(current, skill.targetLevel) / skill.targetLevel : 1;
      return total + completion * DEVELOPMENT_PRIORITY_WEIGHTS[skill.priority];
    }, 0) / totalWeight
  );
}

function skillCompletion(
  target: PlayerDevelopmentTarget,
  state: DevelopmentSimulationState,
  skill: DevelopmentSkill
): number {
  const targetSkill = target.targetSkills.find((item) => item.skill === skill);
  if (!targetSkill || targetSkill.targetLevel === 0) return 1;
  return Math.min(state.skills[skill] ?? 0, targetSkill.targetLevel) / targetSkill.targetLevel;
}

function isTargetComplete(
  target: PlayerDevelopmentTarget,
  state: DevelopmentSimulationState
): boolean {
  return (
    target.targetSkills.length > 0 &&
    target.targetSkills.every((skill) => (state.skills[skill.skill] ?? 0) >= skill.targetLevel)
  );
}

function skillOrder(skill: DevelopmentSkill): number {
  return DEVELOPMENT_SKILL_ORDER.indexOf(skill);
}

function isFinitePositive(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
