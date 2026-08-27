import {
  MongoClubRepository,
  MongoPlayerRepository,
  type PersistedPlayerDevelopmentOverride,
  type SavePlayerDevelopmentOverrideInput
} from "@atlas/database";
import type { ClubId } from "@atlas/database";
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

const playerRepository = new MongoPlayerRepository();
const clubRepository = new MongoClubRepository();

export async function getPlayerDevelopmentTarget(input: {
  playerId: number;
  clubId: ClubId;
}): Promise<PersistedPlayerDevelopmentOverride | null> {
  return playerRepository.findDevelopmentOverride({
    ...input,
    clubId: await resolveNumericClubId(input.clubId)
  });
}

export async function savePlayerDevelopmentTarget(
  input: Omit<SavePlayerDevelopmentOverrideInput, "clubId"> & { clubId: ClubId }
): Promise<PersistedPlayerDevelopmentOverride> {
  return playerRepository.saveDevelopmentOverride({
    ...input,
    clubId: await resolveNumericClubId(input.clubId)
  });
}

export async function resetPlayerDevelopmentTarget(input: {
  playerId: number;
  clubId: ClubId;
}): Promise<void> {
  await playerRepository.deleteDevelopmentOverride({
    ...input,
    clubId: await resolveNumericClubId(input.clubId)
  });
}

async function resolveNumericClubId(clubId: ClubId): Promise<number> {
  const numericClubId = Number(clubId);
  if (Number.isInteger(numericClubId) && numericClubId > 0) {
    return numericClubId;
  }

  const club = await clubRepository.findById(String(clubId));
  if (!club) {
    throw new Error(`Club not found: ${clubId}`);
  }

  return club.clubId;
}
