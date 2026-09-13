import 'dotenv/config';
import { connectMongoDb } from './src/database/index.js';
import { getSquadAssessment } from './src/application/index.js';
import { Types } from 'mongoose';

async function run() {
  await connectMongoDb(process.env.MONGODB_URI);
  try {
    const data = await getSquadAssessment("66f8e7b99c7b9e001c3e3a5a"); // I need the clubId. Let's find it first!
  } catch(e) { console.error(e); }
  process.exit(0);
}
run();
