import mongoose, { type ClientSession } from "mongoose";
import { migrateClubProfileDocuments } from "./migrations/club-profile.js";
import { migrateDevelopmentProfileKeys } from "./migrations/development-profile-keys.js";
import { migratePlayerDevelopmentTargets } from "./migrations/player-development-targets.js";
import { removePlayerTransfersCollection } from "./migrations/remove-player-transfers.js";
import { migrateSnapshotClubIds } from "./migrations/snapshot-club-id.js";
import { migrateSquadRoleAssignments } from "./migrations/squad-role-assignments.js";

export type MongoSession = ClientSession;

let connectionPromise: Promise<typeof mongoose> | null = null;

export async function runMongoMigrations(): Promise<void> {
  await migrateClubProfileDocuments();
  await migratePlayerDevelopmentTargets();
  await migrateSquadRoleAssignments();
  await removePlayerTransfersCollection();
  await migrateDevelopmentProfileKeys();
  await migrateSnapshotClubIds();
}

export async function connectMongoDb(uri: string): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(uri);
  }

  try {
    return await connectionPromise;
  } catch (error) {
    connectionPromise = null;
    throw error;
  }
}

export async function disconnectMongoDb(): Promise<void> {
  connectionPromise = null;
  await mongoose.disconnect();
}

export function mongoTransactionsAvailable(): boolean {
  const client = mongoose.connection.getClient() as unknown as {
    options: { replicaSet?: string };
    topology?: { description?: { type?: string } };
  };
  const topologyType = client.topology?.description?.type;
  return (
    topologyType === "ReplicaSet" ||
    topologyType === "Sharded" ||
    (typeof client.options.replicaSet === "string" && client.options.replicaSet.length > 0)
  );
}

export async function withMongoTransaction<T>(
  work: (session: ClientSession) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();

  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await work(session);
    });

    if (result === undefined) {
      throw new Error("Mongo transaction completed without a result.");
    }

    return result;
  } finally {
    await session.endSession();
  }
}
