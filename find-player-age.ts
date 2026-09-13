import { connectMongoDb } from './src/database/connection.js';
import { getSquadAssessment } from './src/application/squadPlanning/index.js';
import * as tp from './src/domain/playerDevelopment/training-path.js';
import fs from 'fs';

async function run() {
  process.env.MONGODB_URI = "mongodb+srv://admin:adminpwd@cluster0.jwysqma.mongodb.net/sokker-atlas-test";
  await connectMongoDb(process.env.MONGODB_URI);
  try {
    await getSquadAssessment("6a853f236ccacdf90c64b5d0", { forceRecalculate: true });
  } catch (e) {
  }
  process.exit(0);
}
run().catch(console.error);
