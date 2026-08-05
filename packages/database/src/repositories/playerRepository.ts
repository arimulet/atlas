import { Types } from "mongoose";
import { PlayerModel } from "../models/player.js";
import type { PersistedPlayer } from "./types.js";

export interface ResolvePlayerIdentityInput {
  externalId: string | null;
  name: string;
}

export class MongoPlayerRepository {
  async resolveHistoricalIdentity(input: ResolvePlayerIdentityInput): Promise<PersistedPlayer> {
    if (!input.externalId) {
      const player = await PlayerModel.create({ externalId: null, name: input.name });
      return mapPlayer(player.toObject());
    }

    const player = await PlayerModel.findOneAndUpdate(
      { externalId: input.externalId },
      { $set: { name: input.name }, $setOnInsert: { externalId: input.externalId } },
      { new: true, upsert: true }
    );

    return mapPlayer(player.toObject());
  }

  async findByExternalId(externalId: string): Promise<PersistedPlayer | null> {
    const player = await PlayerModel.findOne({ externalId });
    return player ? mapPlayer(player.toObject()) : null;
  }

  async findById(id: string): Promise<PersistedPlayer | null> {
    const player = await PlayerModel.findById(id);
    return player ? mapPlayer(player.toObject()) : null;
  }
}

function mapPlayer(player: {
  _id: Types.ObjectId;
  externalId?: string | null;
  name: string;
}): PersistedPlayer {
  return {
    id: player._id.toString(),
    externalId: player.externalId ?? null,
    name: player.name
  };
}
