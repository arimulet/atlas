import { Types } from "mongoose";
import { ClubModel } from "../models/club.js";
import { SnapshotModel } from "../models/snapshot.js";

export interface SnapshotClubIdMigrationResult {
  migrated: number;
}

export async function migrateSnapshotClubIds(): Promise<SnapshotClubIdMigrationResult> {
  const documents = await SnapshotModel.collection
    .find({ clubId: { $type: "objectId" } })
    .toArray();

  let migrated = 0;

  for (const document of documents) {
    const legacyClubId = document.clubId;
    if (!(legacyClubId instanceof Types.ObjectId)) {
      continue;
    }

    const club = await ClubModel.collection.findOne(
      { _id: legacyClubId },
      { projection: { clubId: 1 } }
    );

    if (!club || typeof club.clubId !== "number") {
      throw new Error(`Cannot migrate snapshot ${document._id}: referenced club was not found.`);
    }

    await SnapshotModel.collection.updateOne(
      { _id: document._id },
      { $set: { clubId: club.clubId } }
    );
    migrated += 1;
  }

  return { migrated };
}
