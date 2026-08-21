import mongoose, { type ClientSession } from "mongoose";
import { migrateClubProfileDocuments } from "./migrations/club-profile.js";
import { migrateSnapshotClubIds } from "./migrations/snapshot-club-id.js";

export type MongoSession = ClientSession;

export async function connectMongoDb(uri: string): Promise<typeof mongoose> {
  const connection = await mongoose.connect(uri);
  await migrateClubProfileDocuments();
  await migrateSnapshotClubIds();
  return connection;
}

export async function disconnectMongoDb(): Promise<void> {
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
