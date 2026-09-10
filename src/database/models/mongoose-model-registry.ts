import mongoose from "mongoose";

export function ensureMongooseModels(): void {
  if (mongoose.models !== undefined) {
    return;
  }

  Object.defineProperty(mongoose, "models", {
    configurable: true,
    enumerable: true,
    value: {},
    writable: true
  });
}
