import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";
import { ensureMongooseModels } from "./mongoose-model-registry.js";

ensureMongooseModels();

const skillSetSchema = new Schema(
  {
    stamina: { type: Number, min: 0, max: 20, default: null },
    pace: { type: Number, min: 0, max: 20, default: null },
    technique: { type: Number, min: 0, max: 20, default: null },
    passing: { type: Number, min: 0, max: 20, default: null },
    keeper: { type: Number, min: 0, max: 20, default: null },
    defender: { type: Number, min: 0, max: 20, default: null },
    playmaker: { type: Number, min: 0, max: 20, default: null },
    striker: { type: Number, min: 0, max: 20, default: null }
  },
  { _id: false }
);

const playerTransferSchema = new Schema(
  {
    transferKey: { type: String, required: true, unique: true, index: true },
    transferId: { type: String, default: null, index: true, sparse: true },
    playerId: { type: Number, default: null, min: 1 },
    transferDate: { type: Date, required: true, index: true },
    gameWeek: { type: Number, default: null },
    salePrice: { type: Number, required: true, min: 0 },
    currency: { type: String, default: null },
    normalizedSalePrice: { type: Number, default: null, min: 0 },
    age: { type: Number, required: true, min: 1, max: 45 },
    skills: { type: skillSetSchema, required: true },
    formation: { type: String, enum: ["GK", "DEF", "MID", "ATT", null], default: null },
    developmentProfile: {
      type: String,
      enum: [
        "goalkeeper",
        "defender",
        "wing_defender",
        "midfielder",
        "winger",
        "forward",
        null
      ],
      default: null
    },
    sokkerValue: { type: Number, default: null, min: 0 },
    source: { type: String, required: true, trim: true },
    dataQuality: { type: String, enum: ["complete", "partial", "weak"], default: null },
    salePriceType: { type: String, enum: ["final_sale", "unknown"], default: "unknown" }
  },
  { timestamps: true }
);

playerTransferSchema.index({ transferDate: 1, developmentProfile: 1 });

export type PlayerTransferDocument = InferSchemaType<typeof playerTransferSchema>;

export const PlayerTransferModel =
  (mongoose.models?.PlayerTransfer as Model<PlayerTransferDocument> | undefined) ??
  model<PlayerTransferDocument>("PlayerTransfer", playerTransferSchema);
