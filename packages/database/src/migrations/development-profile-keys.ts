import { getPlayerDevelopmentTargetModel } from "../models/playerDevelopmentTarget.js";
import { PlayerTransferModel } from "../models/playerTransfer.js";

const PROFILE_KEY_RENAMES = {
  central_defender: "defender",
  central_midfielder: "midfielder"
} as const;

export interface DevelopmentProfileKeyMigrationResult {
  developmentTargets: number;
  playerTransfers: number;
}

export async function migrateDevelopmentProfileKeys(): Promise<DevelopmentProfileKeyMigrationResult> {
  const developmentTargetResults = await Promise.all(
    Object.entries(PROFILE_KEY_RENAMES).map(([legacyProfile, profile]) =>
      getPlayerDevelopmentTargetModel().collection.updateMany(
        { profile: legacyProfile },
        { $set: { profile } }
      )
    )
  );
  const playerTransferResults = await Promise.all(
    Object.entries(PROFILE_KEY_RENAMES).map(([legacyProfile, developmentProfile]) =>
      PlayerTransferModel.collection.updateMany(
        { developmentProfile: legacyProfile },
        { $set: { developmentProfile } }
      )
    )
  );

  return {
    developmentTargets: developmentTargetResults.reduce(
      (total, result) => total + result.modifiedCount,
      0
    ),
    playerTransfers: playerTransferResults.reduce(
      (total, result) => total + result.modifiedCount,
      0
    )
  };
}
