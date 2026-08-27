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
// Sokker's report differentiates the training mode; the factors are kept in
// the Training Domain so consumers do not encode mode-specific percentages.
export const TRAINING_KIND_EFFECTIVENESS = {
  advanced: 1,
  formation: 0.5
} as const;
export const ADVANCED_TRAINING_SLOT_COUNT = 10;
export const ADVANCED_SLOT_REPLACEMENT_THRESHOLD = 0.05;
export const ADVANCED_SLOT_TRIAL_REPLACEMENT_THRESHOLD = 0.12;
export const ADVANCED_SLOT_MAX_TRIALS = 1;
export const ADVANCED_SLOT_HIGH_DEVELOPMENT_POTENTIAL_THRESHOLD = 0.5;

// Calibration thresholds are diagnostic signals. They do not change a training
// decision; they identify predictions and rankings that deserve inspection.
export const TRAINING_CALIBRATION_HIGH_PREDICTION_ERROR_WEEKS = 1;
export const TRAINING_CALIBRATION_MIN_FLAPPING_OBSERVATIONS = 3;
export const TRAINING_CALIBRATION_BORDERLINE_RANK_START = 8;
export const TRAINING_CALIBRATION_BORDERLINE_RANK_END = 12;
export const TRAINING_CALIBRATION_RANK_INSTABILITY_DELTA = 2;

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
