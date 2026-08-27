import { PlayerModel } from "../models/player.js";
import { PlayerTransferModel } from "../models/playerTransfer.js";

const PROFILE_KEY_RENAMES = {
  central_defender: "defender",
  central_midfielder: "midfielder"
} as const;

export interface DevelopmentProfileKeyMigrationResult {
  players: number;
  playerTransfers: number;
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
  const playerTransferResults = await Promise.all(
    Object.entries(PROFILE_KEY_RENAMES).map(([legacyProfile, developmentProfile]) =>
      PlayerTransferModel.collection.updateMany(
        { developmentProfile: legacyProfile },
        { $set: { developmentProfile } }
      )
    )
  );

  return {
    players: developmentTargetResults.reduce(
      (total, result) => total + result.modifiedCount,
      0
    ),
    playerTransfers: playerTransferResults.reduce(
      (total, result) => total + result.modifiedCount,
      0
    )
  };
}
