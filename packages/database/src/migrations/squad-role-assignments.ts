import mongoose, { Types } from "mongoose";
import { PlayerModel } from "../models/player.js";
import type { PersistedSquadRole } from "../repositories/types.js";

const LEGACY_COLLECTION_NAME = "squadroleassignments";
const SQUAD_ROLES: readonly PersistedSquadRole[] = [
  "core",
  "developing",
  "prospect",
  "rotation",
  "depth",
  "transition"
];

export interface SquadRoleAssignmentMigrationResult {
  migrated: number;
  dropped: boolean;
}

export async function migrateSquadRoleAssignments(): Promise<SquadRoleAssignmentMigrationResult> {
  const database = mongoose.connection.db;
  if (!database) {
    throw new Error("MongoDB database is not connected.");
  }

  const collectionExists = await database
    .listCollections({ name: LEGACY_COLLECTION_NAME }, { nameOnly: true })
    .hasNext();
  if (!collectionExists) return { migrated: 0, dropped: false };

  const assignments = await database.collection(LEGACY_COLLECTION_NAME).find({}).toArray();
  let migrated = 0;

  for (const assignment of assignments) {
    const playerId = readPositiveNumber(assignment.playerId);
    const clubId = readPositiveNumber(assignment.clubId);
    const role = readRole(assignment.role);
    if (playerId === null || clubId === null || role === null) {
      throw new Error(`Cannot migrate squad role ${String(assignment._id)}: invalid data.`);
    }

    const player = await PlayerModel.collection.findOne(
      { playerId, clubId },
      { projection: { _id: 1 } }
    );
    if (!player) {
      throw new Error(`Cannot migrate squad role ${String(assignment._id)}: player not found.`);
    }

    await PlayerModel.collection.updateOne(
      { _id: player._id as Types.ObjectId },
      { $set: { role } }
    );
    migrated += 1;
  }

  await database.dropCollection(LEGACY_COLLECTION_NAME);
  return { migrated, dropped: true };
}

function readPositiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function readRole(value: unknown): PersistedSquadRole | null {
  return typeof value === "string" && SQUAD_ROLES.includes(value as PersistedSquadRole)
    ? (value as PersistedSquadRole)
    : null;
}
