import { connectMongoDb } from './src/database/index.js';
import { getSquadAssessment } from './src/application/index.js';
import { getPlayerCollection } from './src/database/index.js';

async function run() {
  process.env.MONGODB_URI = "mongodb+srv://admin:adminpwd@cluster0.jwysqma.mongodb.net/sokker-atlas-test";
  await connectMongoDb(process.env.MONGODB_URI);
  const col = await getPlayerCollection();
  const player = await col.findOne({ "snapshot.player.info.characteristics.base.id": 40312124 });
  console.log("Club ID:", player.clubId);
  const data = await getSquadAssessment(player.clubId);
  console.log("Assessment completed.");
  process.exit(0);
}
run().catch(console.error);
