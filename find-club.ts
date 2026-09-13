import { connectMongoDb } from './src/database/connection.js';

async function run() {
  process.env.MONGODB_URI = "mongodb+srv://admin:adminpwd@cluster0.jwysqma.mongodb.net/sokker-atlas-test";
  await connectMongoDb(process.env.MONGODB_URI);
  const { ClubModel } = await import('./src/database/models/club.js');
  const c = await ClubModel.findOne({ clubId: 6038 });
  console.log("Club ObjectID:", c?._id);
  process.exit(0);
}
run().catch(console.error);
