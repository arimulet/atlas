import {
  PlayerDevelopmentPlanner,
  type DevelopmentPlayer,
  type PlayerDevelopmentPlan,
  type PlayerDevelopmentTargetOverride
} from "@atlas/domain";

export type {
  DevelopmentPlayer,
  DevelopmentProfile,
  DevelopmentProfileReason,
  DevelopmentProfileSuggestion,
  DevelopmentSkill,
  DevelopmentTargetSkill,
  PlayerDevelopmentGap,
  PlayerDevelopmentTarget,
  PlayerDevelopmentTargetOverride
} from "@atlas/domain";

export function buildPlayerDevelopmentPlan(
  player: DevelopmentPlayer,
  manualOverride: PlayerDevelopmentTargetOverride | null = null
): PlayerDevelopmentPlan {
  return new PlayerDevelopmentPlanner().createPlan(player, manualOverride ?? {});
}
