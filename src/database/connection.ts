import mongoose, { type ClientSession } from "mongoose";
import { migrateClubProfileDocuments } from "./migrations/club-profile.js";
import { migrateDevelopmentProfileKeys } from "./migrations/development-profile-keys.js";
import { migratePlayerDevelopmentTargets } from "./migrations/player-development-targets.js";
import { removePlayerTransfersCollection } from "./migrations/remove-player-transfers.js";
import { migrateSnapshotClubIds } from "./migrations/snapshot-club-id.js";
import { migrateSquadRoleAssignments } from "./migrations/squad-role-assignments.js";

export type MongoSession = ClientSession;

interface MongoConnectionCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var __mongoConnectionCache: MongoConnectionCache | undefined;
}

const cached: MongoConnectionCache = globalThis.__mongoConnectionCache ?? {
  conn: null,
  promise: null
};

if (!globalThis.__mongoConnectionCache) {
  globalThis.__mongoConnectionCache = cached;
}

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function runMongoMigrations(): Promise<void> {
  await migrateClubProfileDocuments();
  await migratePlayerDevelopmentTargets();
  await migrateSquadRoleAssignments();
  await removePlayerTransfersCollection();
  await migrateDevelopmentProfileKeys();
  await migrateSnapshotClubIds();
}

export async function connectMongoDb(uri?: string): Promise<typeof mongoose> {
  const targetUri = uri ?? process.env.MONGODB_URI;

  if (mongoose.connection.readyState === 1) {
    cached.conn = mongoose;
    return mongoose;
  }

  if (!targetUri) {
    throw new Error(
      "No MongoDB connection URI provided and MONGODB_URI environment variable is not defined."
    );
  }

  if (!cached.promise || mongoose.connection.readyState === 0) {
    cached.promise = mongoose.connect(targetUri).then((m) => {
      cached.conn = m;
      return m;
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    cached.conn = null;
    throw error;
  }
}

export async function disconnectMongoDb(): Promise<void> {
  cached.conn = null;
  cached.promise = null;
  await mongoose.disconnect();
}

export function mongoTransactionsAvailable(): boolean {
  if (mongoose.connection.readyState !== 1) {
    return false;
  }
  const client = mongoose.connection.getClient() as unknown as {
    options: { replicaSet?: string };
    topology?: { description?: { type?: string } };
  };
  const topologyType = client?.topology?.description?.type;
  return (
    topologyType === "ReplicaSet" ||
    topologyType === "Sharded" ||
    (typeof client?.options?.replicaSet === "string" && client.options.replicaSet.length > 0)
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
