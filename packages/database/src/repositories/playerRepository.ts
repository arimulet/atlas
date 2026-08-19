import { Types, type ClientSession } from "mongoose";
import { PlayerModel } from "../models/player.js";
import type { PersistedPlayer } from "./types.js";

export interface ResolvePlayerIdentityInput {
  playerId: number;
  clubId: number;
  name: string;
}

export class MongoPlayerRepository {
  async resolveHistoricalIdentity(
    input: ResolvePlayerIdentityInput,
    session?: ClientSession
  ): Promise<PersistedPlayer> {
    const player = await PlayerModel.findOneAndUpdate(
      { clubId: input.clubId, playerId: input.playerId },
      {
        $set: { name: input.name },
        $setOnInsert: { clubId: input.clubId, playerId: input.playerId }
      },
      { new: true, upsert: true, runValidators: true, session }
    );

    return mapPlayer(player.toObject());
  }

  async findByPlayerId(input: {
    playerId: number;
    clubId: number;
  }): Promise<PersistedPlayer | null> {
    const player = await PlayerModel.findOne({ playerId: input.playerId, clubId: input.clubId });
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
  clubId: number;
  name: string;
}): PersistedPlayer {
  return {
    id: player._id.toString(),
    playerId: player.playerId,
    clubId: player.clubId,
    name: player.name
  };
}
