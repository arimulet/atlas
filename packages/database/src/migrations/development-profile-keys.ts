import { PlayerModel } from "../models/player.js";

const PROFILE_KEY_RENAMES = {
  central_defender: "defender",
  central_midfielder: "midfielder"
} as const;

export interface DevelopmentProfileKeyMigrationResult {
  players: number;
}

export async function migrateDevelopmentProfileKeys(): Promise<DevelopmentProfileKeyMigrationResult> {
  const developmentTargetResults = await Promise.all(
    Object.entries(PROFILE_KEY_RENAMES).map(([legacyProfile, profile]) =>
      PlayerModel.collection.updateMany(
        { "development.profile": legacyProfile },
        { $set: { "development.profile": profile } }
      )
    )
  );
  return {
    players: developmentTargetResults.reduce(
      (total, result) => total + result.modifiedCount,
      0
    )
  };
}
