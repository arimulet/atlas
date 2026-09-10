import type { DevelopmentProfile } from "../playerDevelopment/index.js";
import type { SquadDepthAnalysisConfig, SquadProfileRequirement } from "./depth-types.js";

export const SQUAD_DEPTH_PROFILE_ORDER: readonly DevelopmentProfile[] = [
  "goalkeeper",
  "defender",
  "midfielder",
  "forward"
];

export const SQUAD_PROFILE_REQUIREMENTS: readonly SquadProfileRequirement[] = [
  { profile: "goalkeeper", minimum: 1, ideal: 2, maximum: 3 },
  { profile: "defender", minimum: 3, ideal: 4, maximum: 5 },
  { profile: "midfielder", minimum: 3, ideal: 4, maximum: 5 },
  { profile: "forward", minimum: 2, ideal: 3, maximum: 4 }
];

export const SQUAD_DEPTH_CONFIG: Readonly<SquadDepthAnalysisConfig> = {
  requirements: SQUAD_PROFILE_REQUIREMENTS,
  strongOptionThreshold: 0.72,
  developingOptionThreshold: 0.5,
  futureOptionThreshold: 0.5,
  singlePlayerDependencyGap: 0.25,
  secondaryProfileWeight: 0.65,
  nextSeasonWeeks: 13,
  mediumTermWeeks: 39,
  futurePipelineCapacityBuffer: 0,
  lateLifecycleConcentrationMinimum: 2
};
