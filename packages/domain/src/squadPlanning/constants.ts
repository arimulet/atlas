import type { SquadPlanningConfig } from "./types.js";

/** Centralized knobs for the first Squad Planning classification model. */
export const SQUAD_PLANNING_CONFIG: Readonly<SquadPlanningConfig> = {
  coreContributionThreshold: 0.72,
  usefulContributionThreshold: 0.5,
  highFutureContributionThreshold: 0.72,
  prospectPotentialThreshold: 0.5,
  developmentGapThreshold: 0.18,
  transitionDevelopmentThreshold: 0.2,
  roleStabilityMargin: 0.08,
  advancedLifecycleAgeFactor: 3.2,
  declineLifecycleAgeFactor: 5.6,
  advancedLifecycleAge: 27,
  declineLifecycleAge: 31,
  highClarityMargin: 0.12
};
