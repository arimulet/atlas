import mongoose from "mongoose";

const LEGACY_COLLECTION_NAME = "playertransfers";

export interface RemovePlayerTransfersResult {
  dropped: boolean;
}

export async function removePlayerTransfersCollection(): Promise<RemovePlayerTransfersResult> {
  const database = mongoose.connection.db;
  if (!database) {
    throw new Error("MongoDB database is not connected.");
  }

  const collectionExists = await database
    .listCollections({ name: LEGACY_COLLECTION_NAME }, { nameOnly: true })
    .hasNext();
  if (!collectionExists) return { dropped: false };

  await database.dropCollection(LEGACY_COLLECTION_NAME);
  return { dropped: true };
}
