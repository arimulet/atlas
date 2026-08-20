import {
  PlayerDevelopmentPlanner,
  type DevelopmentPlayer,
  type PlayerDevelopmentPlan,
  type PlayerDevelopmentTargetOverride
} from "@atlas/domain";

export {
  createDevelopmentSimulationState,
  generateNextTrainingCandidates,
  generatePlayerTrainingPath,
  getNextPlannedTrainingStep,
  projectDevelopment,
  selectBestTrainingCandidate,
  validateDevelopmentTarget
} from "@atlas/domain";

export type {
  DevelopmentPlayer,
  DevelopmentProfile,
  DevelopmentProfileReason,
  DevelopmentProfileSuggestion,
  DevelopmentSkill,
  DevelopmentTargetSkill,
  DevelopmentMilestone,
  DevelopmentCurrentSkillProgress,
  DevelopmentProjectionContext,
  DevelopmentProjectionMilestone,
  DevelopmentProjectionMilestoneType,
  DevelopmentProjectionStatus,
  DevelopmentProjectionStep,
  DevelopmentProjectionWarning,
  DevelopmentSimulationState,
  DevelopmentTrainingKind,
  DevelopmentTrainingAssumptions,
  PlayerDevelopmentGap,
  PlayerDevelopmentProjection,
  PlayerDevelopmentTarget,
  PlayerDevelopmentTargetOverride,
  PlayerTrainingPath,
  TrainingPathCandidate,
  TrainingPathContext,
  TrainingPathReason,
  TrainingPathStep
} from "@atlas/domain";

export function buildPlayerDevelopmentPlan(
  player: DevelopmentPlayer,
  manualOverride: PlayerDevelopmentTargetOverride | null = null
): PlayerDevelopmentPlan {
  return new PlayerDevelopmentPlanner().createPlan(player, manualOverride ?? {});
}
