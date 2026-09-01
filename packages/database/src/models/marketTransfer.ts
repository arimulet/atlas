import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";
import { ensureMongooseModels } from "./mongoose-model-registry.js";

ensureMongooseModels();

const marketTransferSchema = new Schema(
  {
    transferKey: { type: String, required: true },
    playerId: { type: Number, required: true },
    name: { type: String, required: true, trim: true },
    transferDate: { type: Date, required: true },
    gameWeek: { type: Number, required: true },
    season: { type: Number, required: true },
    week: { type: Number, required: true },
    salePrice: { type: Number, required: true },
    age: { type: Number, required: true },
    skills: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

marketTransferSchema.index({ transferKey: 1 }, { unique: true });
marketTransferSchema.index({ transferDate: -1 });
marketTransferSchema.index({ playerId: 1 });

type MarketTransferDocument = InferSchemaType<typeof marketTransferSchema>;

export const MarketTransferModel =
  (mongoose.models?.marketTransfers as Model<MarketTransferDocument> | undefined) ??
  model<MarketTransferDocument>("marketTransfers", marketTransferSchema);
