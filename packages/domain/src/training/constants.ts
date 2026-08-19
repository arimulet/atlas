import type { SkillTrainingCostSkill } from "./types.js";

export const BASE_TRAINING_AGE = 16;
export const AGE_TRAINING_FACTOR = 1.094;

export const MAX_EFFICIENCY = 100;

export const SKILL_LEVEL_TRAINING_FACTOR = 1.094;
export const MAX_SKILL_LEVEL = 18;
export const MAX_TRAINING_EFFICIENCY = 100;
export const BASE_TRAINING_POINTS = 47;
export const DEFAULT_TALENT_PROFILE_MINIMUM_OBSERVATIONS = 2;
export const DEFAULT_TALENT_FOR_RELATIVE_COMPARISON = 1;
export const TRAINING_RECOMMENDATION_MIN_HISTORY_WEEKS = 2;
export const TRAINING_RECOMMENDATION_SKILL_UP_SOON_WEEKS = 2;
export const TRAINING_RECOMMENDATION_HIGH_NEXT_LEVEL_WEEKS = 3;
export const TRAINING_RECOMMENDATION_SWITCH_THRESHOLD = 1.15;
export const TRAINING_RECOMMENDATION_RECENT_SWITCH_THRESHOLD = 1.25;
export const TRAINING_RECOMMENDATION_SCORE_NORMALIZATION_BASE = 1;

export const SUPPORTED_TRAINING_SKILLS: readonly SkillTrainingCostSkill[] = [
  "stamina",
  "keeper",
  "pace",
  "scoring",
  "defending",
  "technique",
  "playmaking",
  "passing"
];

export const SKILL_TRAINING_BASE_LEVEL: Readonly<Record<SkillTrainingCostSkill, number>> = {
  stamina: 4,
  keeper: 4,
  pace: 4,
  scoring: 4,
  defending: 6,
  technique: 6,
  playmaking: 6,
  passing: 6
};
