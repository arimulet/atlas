import { Types } from "mongoose";
import { ClubModel } from "../models/club.js";
import type { PersistedClub } from "./types.js";

export interface SaveClubInput {
  externalId: string | null;
  name: string;
}

export class MongoClubRepository {
  async save(input: SaveClubInput): Promise<PersistedClub> {
    if (!input.externalId) {
      const club = await ClubModel.create(input);
      return mapClub(club.toObject());
    }

    const club = await ClubModel.findOneAndUpdate(
      { externalId: input.externalId },
      { $set: { name: input.name }, $setOnInsert: { externalId: input.externalId } },
      { new: true, upsert: true }
    );

    return mapClub(club.toObject());
  }

  async findById(id: string): Promise<PersistedClub | null> {
    const club = await ClubModel.findById(id);
    return club ? mapClub(club.toObject()) : null;
  }
}

function mapClub(club: {
  _id: Types.ObjectId;
  externalId?: string | null;
  name: string;
}): PersistedClub {
  return {
    id: club._id.toString(),
    externalId: club.externalId ?? null,
    name: club.name
  };
}
