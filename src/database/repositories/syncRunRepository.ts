import { Types, type ClientSession } from "mongoose";
import { SyncRunModel } from "../models/syncRun.js";

export interface StartSyncRunInput {
  teamId: number;
  gameWeek: number;
  startedAt?: Date;
}

export class MongoSyncRunRepository {
  async start(input: StartSyncRunInput, session?: ClientSession): Promise<string> {
    const startedAt = input.startedAt ?? new Date();
    const [run] = await SyncRunModel.create(
      [
        {
          teamId: input.teamId,
          gameWeek: input.gameWeek,
          startedAt,
          status: "running",
          completedAt: null,
          error: null
        }
      ],
      { session }
    );

    return run!._id.toString();
  }

  async complete(id: string, completedAt = new Date(), session?: ClientSession): Promise<void> {
    const run = await SyncRunModel.findByIdAndUpdate(
      new Types.ObjectId(id),
      { $set: { status: "completed", completedAt, error: null } },
      { session }
    );
    if (!run) {
      throw new Error(`Sync run not found: ${id}`);
    }
  }

  async fail(id: string, error: string, completedAt = new Date()): Promise<void> {
    const run = await SyncRunModel.findByIdAndUpdate(new Types.ObjectId(id), {
      $set: { status: "failed", completedAt, error }
    });
    if (!run) {
      throw new Error(`Sync run not found: ${id}`);
    }
  }
}
