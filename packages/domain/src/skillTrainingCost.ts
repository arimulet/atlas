export type SkillTrainingCostSkill =
  "pace" | "scoring" | "defending" | "technique" | "playmaking" | "passing";

export interface SkillTrainingCostInput {
  skill: SkillTrainingCostSkill;
  targetSkillLevel: number;
}

export interface SkillTrainingCostResult {
  skill: SkillTrainingCostSkill;
  targetSkillLevel: number;
  baseLevel: number;
  exponent: number;
  costFactor: number;
}

export const SKILL_LEVEL_TRAINING_FACTOR = 1.094;

export const SKILL_TRAINING_BASE_LEVEL: Readonly<Record<SkillTrainingCostSkill, number>> = {
  pace: 4,
  scoring: 4,
  defending: 6,
  technique: 6,
  playmaking: 6,
  passing: 6
};

export function calculateSkillTrainingCostFactor(
  input: SkillTrainingCostInput
): SkillTrainingCostResult {
  assertSupportedSkill(input.skill);
  assertValidTargetSkillLevel(input.targetSkillLevel);

  const baseLevel = SKILL_TRAINING_BASE_LEVEL[input.skill];
  const exponent = input.targetSkillLevel - baseLevel;

  return {
    skill: input.skill,
    targetSkillLevel: input.targetSkillLevel,
    baseLevel,
    exponent,
    costFactor: Math.pow(SKILL_LEVEL_TRAINING_FACTOR, exponent)
  };
}

export function calculateSkillTrainingSpeedFactor(input: SkillTrainingCostInput): number {
  return 1 / calculateSkillTrainingCostFactor(input).costFactor;
}

function assertSupportedSkill(skill: string): asserts skill is SkillTrainingCostSkill {
  if (!Object.hasOwn(SKILL_TRAINING_BASE_LEVEL, skill)) {
    throw new Error(`skill must be one of: ${Object.keys(SKILL_TRAINING_BASE_LEVEL).join(", ")}.`);
  }
}

function assertValidTargetSkillLevel(targetSkillLevel: number): void {
  if (!Number.isInteger(targetSkillLevel) || targetSkillLevel < 0 || targetSkillLevel > 18) {
    throw new Error("targetSkillLevel must be an integer between 0 and 18.");
  }
}
