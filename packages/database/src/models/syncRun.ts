import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";
import { ensureMongooseModels } from "./mongoose-model-registry.js";

ensureMongooseModels();

const syncRunSchema = new Schema(
  {
    teamId: { type: Number, required: true, min: 1 },
    gameWeek: { type: Number, required: true, min: 1 },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    status: { type: String, enum: ["running", "completed", "failed"], required: true },
    error: { type: String, default: null }
  },
  { timestamps: true }
);

syncRunSchema.index({ teamId: 1, gameWeek: 1, startedAt: -1 });

export type SyncRunDocument = InferSchemaType<typeof syncRunSchema>;

export const SyncRunModel =
  (mongoose.models?.SyncRun as Model<SyncRunDocument> | undefined) ??
  model<SyncRunDocument>("SyncRun", syncRunSchema);
