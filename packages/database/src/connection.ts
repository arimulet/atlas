import mongoose from "mongoose";

export async function connectMongoDb(uri: string): Promise<typeof mongoose> {
  return mongoose.connect(uri);
}

export async function disconnectMongoDb(): Promise<void> {
  await mongoose.disconnect();
}
