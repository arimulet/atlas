import fs from "fs";

// Load environment variables natively from .env (Node 24+)
if (fs.existsSync(".env")) {
  process.loadEnvFile(".env");
}

import { runMarketTransferSyncJob } from "@atlas/application";
import { connectMongoDb, disconnectMongoDb } from "@atlas/database";

async function main() {
  console.log("[MarketTransferSyncRunner] Starting standalone Cloud Run Job execution...");

  const login = process.env.SOKKER_MARKET_LOGIN;
  const password = process.env.SOKKER_MARKET_PASSWORD;
  const mongoUri = process.env.MONGODB_URI;

  if (!login || !password) {
    console.error(
      "[MarketTransferSyncRunner] Error: SOKKER_MARKET_LOGIN or SOKKER_MARKET_PASSWORD environment variables are missing."
    );
    process.exit(1);
  }

  if (mongoUri) {
    console.log("[MarketTransferSyncRunner] Connecting to MongoDB...");
    await connectMongoDb(mongoUri);
  } else {
    console.warn("[MarketTransferSyncRunner] Warning: MONGODB_URI environment variable is not defined.");
  }

  const startTime = Date.now();
  try {
    const result = await runMarketTransferSyncJob(login, password);
    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

    if (result.success) {
      console.log(`[MarketTransferSyncRunner] Job completed successfully in ${durationSec}s. (runId: ${result.runId})`);
      await disconnectMongoDb().catch(() => null);
      process.exit(0);
    } else {
      console.error(
        `[MarketTransferSyncRunner] Job execution failed (reason: ${JSON.stringify(result.reason)})`
      );
      await disconnectMongoDb().catch(() => null);
      process.exit(1);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[MarketTransferSyncRunner] Uncaught error during job execution:", errorMsg);
    await disconnectMongoDb().catch(() => null);
    process.exit(1);
  }
}

main();
