import { SQUAD_DEPTH_CONFIG } from "./depth-constants.js";
import type { SquadPlanningRecommendationConfig } from "./recommendation-types.js";

export const SQUAD_PLANNING_RECOMMENDATION_CONFIG: Readonly<SquadPlanningRecommendationConfig> = {
  internalCandidateThreshold: SQUAD_DEPTH_CONFIG.futureOptionThreshold,
  reprofileSuitabilityThreshold: 0.7,
  reprofileAdvantageMargin: 0.05,
  dependencyHighGap: 0.4,
  stabilityMargin: 0.1,
  accelerateWindowWeeks: 13,
  mediumTermWeeks: SQUAD_DEPTH_CONFIG.mediumTermWeeks,
  emitMaintainRecommendations: true
};
