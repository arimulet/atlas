import { Types } from "mongoose";
import { ImportEventModel } from "../models/importEvent.js";
import type { PersistedImportEvent, PersistedImportIssue } from "./types.js";

export interface CreateImportEventInput {
  schemaVersion: string | null;
  sourceType: string | null;
  status: "accepted" | "accepted-with-warnings" | "rejected";
  errors: PersistedImportIssue[];
  warnings: PersistedImportIssue[];
}

export class MongoImportEventRepository {
  async create(input: CreateImportEventInput): Promise<PersistedImportEvent> {
    const event = await ImportEventModel.create(input);
    return mapImportEvent(event.toObject());
  }

  async attachResult(
    id: string,
    result: { clubId: string; snapshotId: string }
  ): Promise<PersistedImportEvent> {
    const event = await ImportEventModel.findByIdAndUpdate(
      id,
      {
        $set: {
          clubId: new Types.ObjectId(result.clubId),
          snapshotId: new Types.ObjectId(result.snapshotId)
        }
      },
      { new: true }
    );

    if (!event) {
      throw new Error(`Import event not found: ${id}`);
    }

    return mapImportEvent(event.toObject());
  }

  async findById(id: string): Promise<PersistedImportEvent | null> {
    const event = await ImportEventModel.findById(id);
    return event ? mapImportEvent(event.toObject()) : null;
  }
}

function mapImportEvent(event: {
  _id: Types.ObjectId;
  schemaVersion?: string | null;
  sourceType?: string | null;
  status: "accepted" | "accepted-with-warnings" | "rejected";
  errors: PersistedImportIssue[];
  warnings: PersistedImportIssue[];
  clubId?: Types.ObjectId | null;
  snapshotId?: Types.ObjectId | null;
  importedAt: Date;
}): PersistedImportEvent {
  return {
    id: event._id.toString(),
    schemaVersion: event.schemaVersion ?? null,
    sourceType: event.sourceType ?? null,
    status: event.status,
    errors: event.errors,
    warnings: event.warnings,
    clubId: event.clubId?.toString() ?? null,
    snapshotId: event.snapshotId?.toString() ?? null,
    importedAt: event.importedAt
  };
}
