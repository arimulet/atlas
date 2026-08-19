import { type ClientSession } from "mongoose";
import { JuniorModel } from "../models/junior.js";

export interface UpsertJuniorInput {
  teamId: number;
  juniorId: number;
  name: { firstName: string; lastName: string; fullName: string };
  age: number;
  currentLevel: number;
  weeksLeft: number;
}

export class MongoJuniorRepository {
  async upsertMany(inputs: readonly UpsertJuniorInput[], session?: ClientSession): Promise<number> {
    if (inputs.length === 0) {
      return 0;
    }

    await JuniorModel.bulkWrite(
      inputs.map(({ teamId, juniorId, ...fields }) => ({
        updateOne: {
          filter: { teamId, juniorId },
          update: {
            $set: { ...fields, active: true },
            $setOnInsert: { teamId, juniorId }
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
    activeJuniorIds: readonly number[],
    session?: ClientSession
  ): Promise<void> {
    await JuniorModel.updateMany(
      {
        teamId,
        ...(activeJuniorIds.length > 0 ? { juniorId: { $nin: activeJuniorIds } } : {})
      },
      { $set: { active: false } },
      { session }
    );
  }
}
