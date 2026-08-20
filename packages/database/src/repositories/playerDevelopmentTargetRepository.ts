import { Types } from "mongoose";
import { getPlayerDevelopmentTargetModel } from "../models/playerDevelopmentTarget.js";
import type {
  PersistedPlayerDevelopmentOverride,
  SavePlayerDevelopmentOverrideInput
} from "./types.js";

export class MongoPlayerDevelopmentTargetRepository {
  async findByPlayerId(input: {
    playerId: number;
    clubId: number;
  }): Promise<PersistedPlayerDevelopmentOverride | null> {
    const target = await getPlayerDevelopmentTargetModel().findOne(input);
    return target ? mapOverride(target) : null;
  }

  async saveManualOverride(
    input: SavePlayerDevelopmentOverrideInput
  ): Promise<PersistedPlayerDevelopmentOverride> {
    const target = await getPlayerDevelopmentTargetModel().findOneAndUpdate(
      { playerId: input.playerId, clubId: input.clubId },
      {
        $set: {
          profile: input.profile ?? null,
          targetLevels: input.targetLevels ?? {},
          targetAge: input.targetAge ?? null
        },
        $setOnInsert: { playerId: input.playerId, clubId: input.clubId }
      },
      { new: true, upsert: true, runValidators: true }
    );

    return mapOverride(target);
  }

  async deleteManualOverride(input: { playerId: number; clubId: number }): Promise<void> {
    await getPlayerDevelopmentTargetModel().deleteOne(input);
  }
}

function mapOverride(target: {
  _id: Types.ObjectId;
  playerId: number;
  clubId: number;
  profile?: PersistedPlayerDevelopmentOverride["profile"];
  targetLevels?: Map<string, number> | null;
  targetAge?: number | null;
}): PersistedPlayerDevelopmentOverride {
  return {
    id: target._id.toString(),
    playerId: target.playerId,
    clubId: target.clubId,
    profile: target.profile ?? null,
    targetLevels: target.targetLevels ? Object.fromEntries(target.targetLevels.entries()) : {},
    targetAge: target.targetAge ?? null
  };
}
