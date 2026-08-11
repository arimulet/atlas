import { Types } from "mongoose";
import { PlayerModel } from "../models/player.js";
import type { PersistedPlayer } from "./types.js";

export interface ResolvePlayerIdentityInput {
  playerId: number;
  name: string;
}

export class MongoPlayerRepository {
  async resolveHistoricalIdentity(input: ResolvePlayerIdentityInput): Promise<PersistedPlayer> {
    const player = await PlayerModel.findOneAndUpdate(
      { playerId: input.playerId },
      { $set: { name: input.name }, $setOnInsert: { playerId: input.playerId } },
      { new: true, upsert: true, runValidators: true }
    );

    return mapPlayer(player.toObject());
  }

  async findByPlayerId(playerId: number): Promise<PersistedPlayer | null> {
    const player = await PlayerModel.findOne({ playerId });
    return player ? mapPlayer(player.toObject()) : null;
  }

  async findById(id: string): Promise<PersistedPlayer | null> {
    const player = await PlayerModel.findById(id);
    return player ? mapPlayer(player.toObject()) : null;
  }
}

function mapPlayer(player: {
  _id: Types.ObjectId;
  playerId: number;
  name: string;
}): PersistedPlayer {
  return {
    id: player._id.toString(),
    playerId: player.playerId,
    name: player.name
  };
}
