import type { SquadPlanningConfig } from "./types.js";

/** Centralized knobs for the first Squad Planning classification model. */
export const SQUAD_PLANNING_CONFIG: Readonly<SquadPlanningConfig> = {
  coreContributionThreshold: 0.72,
  usefulContributionThreshold: 0.5,
  highFutureContributionThreshold: 0.72,
  corePrimarySkillMinimum: 17,
  rotationPrimarySkillMinimum: 15,
  coreStaminaMinimum: 11,
  rotationStaminaMinimum: 10,
  prospectMaximumAge: 20,
  prospectPotentialThreshold: 0.5,
  developmentGapThreshold: 0.18,
  transitionDevelopmentThreshold: 0.2,
  roleStabilityMargin: 0.08,
  advancedLifecycleAgeFactor: 4.2,
  declineLifecycleAgeFactor: 5,
  advancedLifecycleAge: 32,
  declineLifecycleAge: 34,
  highClarityMargin: 0.12
};
