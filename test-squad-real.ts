import { connectMongoDb } from './src/database/connection.js';
import { getSquadAssessment } from './src/application/squadPlanning/index.js';

async function run() {
  process.env.MONGODB_URI = "mongodb+srv://admin:adminpwd@cluster0.jwysqma.mongodb.net/sokker-atlas-test";
  await connectMongoDb(process.env.MONGODB_URI);
  try {
    const data = await getSquadAssessment("6a853f236ccacdf90c64b5d0", { forceRecalculate: true });
    console.log("Success! Depth players:", data.depthPlayers.length);
    const p = data.depthPlayers.find(x => x.playerId === 40312124);
    if (p) {
      console.log("Player market value current:", p.marketValue);
    } else {
      console.log("Player 40312124 not found in depthPlayers!");
    }
  } catch (e) {
    console.error("Top level error:", e);
  }
  process.exit(0);
}
run().catch(console.error);
