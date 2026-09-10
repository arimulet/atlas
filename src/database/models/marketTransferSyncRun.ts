import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";
import { ensureMongooseModels } from "./mongoose-model-registry.js";

ensureMongooseModels();

const countsSchema = new Schema(
  {
    pagesRead: { type: Number, required: true },
    currentUpserted: { type: Number, required: true },
    currentMissing: { type: Number, required: true },
    finalCreatedOrUpdated: { type: Number, required: true },
    currentDeleted: { type: Number, required: true }
  },
  { _id: false }
);

const marketTransferSyncRunSchema = new Schema(
  {
    status: { type: String, enum: ["running", "completed", "failed"], required: true },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, default: null },
    leaseExpiresAt: { type: Date, required: true },
    historyWindow: {
      from: { type: Date, required: true },
      to: { type: Date, required: true }
    },
    counts: { type: countsSchema, required: true },
    error: { type: String, default: null }
  },
  { timestamps: true }
);

type MarketTransferSyncRunDocument = InferSchemaType<typeof marketTransferSyncRunSchema>;

export const MarketTransferSyncRunModel =
  (mongoose.models?.marketTransfers_syncruns as Model<MarketTransferSyncRunDocument> | undefined) ??
  model<MarketTransferSyncRunDocument>("marketTransfers_syncruns", marketTransferSyncRunSchema);
