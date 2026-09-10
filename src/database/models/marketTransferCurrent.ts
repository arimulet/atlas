import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";
import { ensureMongooseModels } from "./mongoose-model-registry.js";

ensureMongooseModels();

const playerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    countryId: { type: Number, required: true },
    age: { type: Number, required: true },
    skills: { type: Schema.Types.Mixed, default: {} }
  },
  { _id: false }
);

const marketTransferCurrentSchema = new Schema(
  {
    playerId: { type: Number, required: true },
    firstSeenAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    deadline: { type: Date, required: true },
    status: { type: String, enum: ["active", "missing"], required: true },
    lastSyncRunId: { type: String, required: true },
    player: { type: playerSchema, required: true }
  },
  { timestamps: true }
);

marketTransferCurrentSchema.index({ playerId: 1 }, { unique: true });

type MarketTransferCurrentDocument = InferSchemaType<typeof marketTransferCurrentSchema>;

export const MarketTransferCurrentModel =
  (mongoose.models?.marketTransfers_current as Model<MarketTransferCurrentDocument> | undefined) ??
  model<MarketTransferCurrentDocument>("marketTransfers_current", marketTransferCurrentSchema);
