import mongoose, { Types } from "mongoose";
import { PlayerModel } from "../models/player.js";

const LEGACY_COLLECTION_NAME = "playerdevelopmenttargets";

export interface PlayerDevelopmentTargetMigrationResult {
  migrated: number;
  dropped: boolean;
}

export async function migratePlayerDevelopmentTargets(): Promise<PlayerDevelopmentTargetMigrationResult> {
  const database = mongoose.connection.db;
  if (!database) {
    throw new Error("MongoDB database is not connected.");
  }

  const legacyCollectionExists = await database
    .listCollections({ name: LEGACY_COLLECTION_NAME }, { nameOnly: true })
    .hasNext();
  if (!legacyCollectionExists) return { migrated: 0, dropped: false };

  const legacyTargets = await database
    .collection(LEGACY_COLLECTION_NAME)
    .find({})
    .toArray();

  let migrated = 0;
  for (const target of legacyTargets) {
    const playerId = readPositiveNumber(target.playerId);
    const clubId = readPositiveNumber(target.clubId);
    if (playerId === null || clubId === null) {
      throw new Error(`Cannot migrate development target ${String(target._id)}: invalid identity.`);
    }

    const player = await PlayerModel.collection.findOne({ playerId, clubId }, { projection: { _id: 1 } });
    if (!player) {
      throw new Error(`Cannot migrate development target ${String(target._id)}: player not found.`);
    }

    await PlayerModel.collection.updateOne(
      { _id: player._id as Types.ObjectId },
      {
        $set: {
          development: {
            profile: readProfile(target.profile),
            targetLevels: readTargetLevels(target.targetLevels)
          }
        }
      }
    );
    migrated += 1;
  }

  await database.dropCollection(LEGACY_COLLECTION_NAME);
  return { migrated, dropped: true };
}

function readPositiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function readProfile(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value === "central_defender") return "defender";
  if (value === "central_midfielder") return "midfielder";
  return value;
}

function readTargetLevels(value: unknown): Record<string, number> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === "number" && Number.isInteger(entry[1]) && entry[1] >= 1
    )
  );
}
