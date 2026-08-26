import {
  MongoPlayerDevelopmentTargetRepository,
  type PersistedPlayerDevelopmentOverride,
  type SavePlayerDevelopmentOverrideInput
} from "@atlas/database";
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

const playerDevelopmentTargetRepository = new MongoPlayerDevelopmentTargetRepository();

export async function getPlayerDevelopmentTarget(input: {
  playerId: number;
  clubId: number;
}): Promise<PersistedPlayerDevelopmentOverride | null> {
  return playerDevelopmentTargetRepository.findByPlayerId(input);
}

export async function savePlayerDevelopmentTarget(
  input: SavePlayerDevelopmentOverrideInput
): Promise<PersistedPlayerDevelopmentOverride> {
  return playerDevelopmentTargetRepository.saveManualOverride(input);
}

export async function resetPlayerDevelopmentTarget(input: {
  playerId: number;
  clubId: number;
}): Promise<void> {
  await playerDevelopmentTargetRepository.deleteManualOverride(input);
}
