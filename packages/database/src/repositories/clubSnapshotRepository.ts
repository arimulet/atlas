import { type ClientSession } from "mongoose";
import { ClubSnapshotModel } from "../models/clubSnapshot.js";

export interface UpsertClubSnapshotInput {
  teamId: number;
  gameWeek: number;
  season: number;
  seasonWeek: number;
  date: Date;
  team: {
    id: number;
    name: string;
    rank: number;
    rankPosition: number;
    country: { code: number; name: string };
    bankrupt: boolean;
  };
  budget: { value: number; currency: string };
}

export class MongoClubSnapshotRepository {
  async upsert(input: UpsertClubSnapshotInput, session?: ClientSession): Promise<void> {
    await ClubSnapshotModel.updateOne(
      { teamId: input.teamId, gameWeek: input.gameWeek },
      { $set: input },
      { upsert: true, session }
    );
  }
}
