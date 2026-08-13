import type { SkillTrainingCostSkill } from "./types.js";

export const BASE_TRAINING_AGE = 16;
export const AGE_TRAINING_FACTOR = 1.094;

export const FRIENDLY_MATCH_WEIGHT = 0.75;
export const FIRST_EFFICIENCY_THRESHOLD = 90;
export const MAX_EQUIVALENT_MINUTES = 180;
export const FIRST_SEGMENT_EFFICIENCY = 93;
export const MAX_EFFICIENCY = 100;
export const ADVANCED_BASE_EFFICIENCY = 50;

export const SKILL_LEVEL_TRAINING_FACTOR = 1.094;
export const MAX_SKILL_LEVEL = 18;
export const MAX_TRAINING_EFFICIENCY = 100;
export const DEFAULT_TALENT_PROFILE_MINIMUM_OBSERVATIONS = 2;

export const SUPPORTED_TRAINING_SKILLS: readonly SkillTrainingCostSkill[] = [
  "pace",
  "scoring",
  "defending",
  "technique",
  "playmaking",
  "passing"
];

export const SKILL_TRAINING_BASE_LEVEL: Readonly<Record<SkillTrainingCostSkill, number>> = {
  pace: 4,
  scoring: 4,
  defending: 6,
  technique: 6,
  playmaking: 6,
  passing: 6
};
