import { type ClientSession } from "mongoose";
import { TrainingSummaryModel } from "../models/trainingSummary.js";

export interface UpsertTrainingSummaryInput {
  teamId: number;
  gameWeek: number;
  season: number;
  seasonWeek: number;
  date: Date;
  players: {
    formationTraining: number;
    advancedTraining: number;
    skillsUp: number;
  };
  juniors: { count: number; skillsUp: number };
}

export class MongoTrainingSummaryRepository {
  async upsertMany(
    inputs: readonly UpsertTrainingSummaryInput[],
    session?: ClientSession
  ): Promise<number> {
    if (inputs.length === 0) {
      return 0;
    }

    await TrainingSummaryModel.bulkWrite(
      inputs.map((input) => ({
        updateOne: {
          filter: { teamId: input.teamId, gameWeek: input.gameWeek },
          update: { $set: input },
          upsert: true
        }
      })),
      { session }
    );

    return inputs.length;
  }
}
