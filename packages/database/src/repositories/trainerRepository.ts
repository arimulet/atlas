import { type ClientSession } from "mongoose";
import { TrainerModel } from "../models/trainer.js";

export interface UpsertTrainerInput {
  teamId: number;
  trainerId: number;
  name: { firstName: string; lastName: string; fullName: string };
  assignment: "HEAD" | "ASSISTANT" | "YOUTH";
  contracted: boolean;
  salary: { value: number; currency: string };
  age: number;
  skills: Record<string, { level: number; effectivenessPercent: number }>;
  averageEffectivenessPercent: number;
  status: string;
}

export class MongoTrainerRepository {
  async upsertMany(
    inputs: readonly UpsertTrainerInput[],
    session?: ClientSession
  ): Promise<number> {
    if (inputs.length === 0) {
      return 0;
    }

    await TrainerModel.bulkWrite(
      inputs.map(({ teamId, trainerId, ...fields }) => ({
        updateOne: {
          filter: { teamId, trainerId },
          update: {
            $set: { ...fields, active: true },
            $setOnInsert: { teamId, trainerId }
          },
          upsert: true
        }
      })),
      { session }
    );

    return inputs.length;
  }

  async deactivateMissing(
    teamId: number,
    activeTrainerIds: readonly number[],
    session?: ClientSession
  ): Promise<void> {
    await TrainerModel.updateMany(
      {
        teamId,
        ...(activeTrainerIds.length > 0 ? { trainerId: { $nin: activeTrainerIds } } : {})
      },
      { $set: { active: false } },
      { session }
    );
  }
}
