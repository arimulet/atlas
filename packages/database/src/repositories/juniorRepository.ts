import { Types, type ClientSession } from "mongoose";
import { JuniorModel } from "../models/junior.js";
import type { PersistedJunior } from "./types.js";

export interface ResolveJuniorIdentityInput {
  juniorId: number;
  clubId: number;
  name: string;
  age: number;
  currentLevel: number;
  weeksLeft: number;
}

export type JuniorStatus = "in_academy" | "promoted" | "rejected";

export class MongoJuniorRepository {
  async resolveCurrentIdentity(
    input: ResolveJuniorIdentityInput,
    session?: ClientSession
  ): Promise<PersistedJunior> {
    const junior = await JuniorModel.findOneAndUpdate(
      { clubId: input.clubId, juniorId: input.juniorId },
      {
        $set: {
          name: input.name,
          age: input.age,
          currentLevel: input.currentLevel,
          weeksLeft: input.weeksLeft,
          status: "in_academy"
        },
        $setOnInsert: {
          clubId: input.clubId,
          juniorId: input.juniorId,
          initialWeeks: input.weeksLeft
        }
      },
      { new: true, upsert: true, runValidators: true, session }
    );

    return mapJunior(junior.toObject());
  }

  async findByJuniorId(input: {
    juniorId: number;
    clubId: number;
  }): Promise<PersistedJunior | null> {
    const junior = await JuniorModel.findOne({
      juniorId: input.juniorId,
      clubId: input.clubId
    });
    return junior ? mapJunior(junior.toObject()) : null;
  }

  async listByClub(clubId: number): Promise<PersistedJunior[]> {
    const juniors = await JuniorModel.find({ clubId }).sort({ juniorId: 1 });
    return juniors.map((junior) => mapJunior(junior.toObject()));
  }

  async markMissingStatuses(
    clubId: number,
    currentJuniorIds: readonly number[],
    promotedJuniorIds: readonly number[],
    session?: ClientSession
  ): Promise<void> {
    await JuniorModel.updateMany(
      {
        clubId,
        juniorId: { $nin: currentJuniorIds, $in: promotedJuniorIds }
      },
      { $set: { status: "promoted" } },
      { session }
    );
    await JuniorModel.updateMany(
      {
        clubId,
        juniorId: { $nin: [...currentJuniorIds, ...promotedJuniorIds] }
      },
      { $set: { status: "rejected" } },
      { session }
    );
  }

  async findById(id: string): Promise<PersistedJunior | null> {
    const junior = await JuniorModel.findById(id);
    return junior ? mapJunior(junior.toObject()) : null;
  }
}

function mapJunior(junior: {
  _id: Types.ObjectId;
  juniorId: number;
  clubId: number;
  name: string;
  age: number;
  currentLevel: number;
  initialWeeks: number;
  weeksLeft: number;
  status: JuniorStatus;
}): PersistedJunior {
  return {
    id: junior._id.toString(),
    juniorId: junior.juniorId,
    clubId: junior.clubId,
    name: junior.name,
    age: junior.age,
    currentLevel: junior.currentLevel,
    initialWeeks: junior.initialWeeks,
    weeksLeft: junior.weeksLeft,
    status: junior.status
  };
}
