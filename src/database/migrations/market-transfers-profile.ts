import mongoose from "mongoose";
import { suggestDevelopmentProfile } from "@atlas/domain";
import { MarketTransferModel } from "../models/marketTransfer.js";

export interface MarketTransfersProfileMigrationResult {
  totalFound: number;
  updated: number;
}

export async function migrateMarketTransfersProfile(): Promise<MarketTransfersProfileMigrationResult> {
  const database = mongoose.connection.db;
  if (!database) {
    throw new Error("MongoDB database is not connected.");
  }

  // Find all market transfers where profile is missing, null, or empty
  const docs = await MarketTransferModel.find({
    $or: [{ profile: { $exists: false } }, { profile: null }, { profile: "" }]
  })
    .select({ playerId: 1, age: 1, skills: 1 })
    .lean();

  if (docs.length === 0) {
    // Still ensure index
    await MarketTransferModel.createIndexes();
    return { totalFound: 0, updated: 0 };
  }

  const bulkOps = docs.map((doc) => {
    const suggestion = suggestDevelopmentProfile({
      playerId: doc.playerId,
      age: doc.age,
      skills: (doc.skills as Record<string, number>) ?? {}
    });

    return {
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { profile: suggestion.profile } }
      }
    };
  });

  // Execute in chunks of 500
  const CHUNK_SIZE = 500;
  let updated = 0;
  for (let i = 0; i < bulkOps.length; i += CHUNK_SIZE) {
    const chunk = bulkOps.slice(i, i + CHUNK_SIZE);
    const result = await MarketTransferModel.bulkWrite(chunk, { ordered: false });
    updated += result.modifiedCount;
  }

  // Ensure indexes
  await MarketTransferModel.createIndexes();

  return { totalFound: docs.length, updated };
}

// Support running directly from CLI
const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("market-transfers-profile.ts") ||
    process.argv[1].endsWith("market-transfers-profile.js"));

if (isMain) {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("Missing MONGODB_URI environment variable.");
    process.exit(1);
  }
  void (async () => {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("Running market transfers profile migration...");
    const result = await migrateMarketTransfersProfile();
    console.log("Migration finished:", result);
    await mongoose.disconnect();
    process.exit(0);
  })().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}
