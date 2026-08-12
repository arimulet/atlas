import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

const manualRecordSchema = new Schema(
  {
    key: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
    updatedAt: { type: Date, required: true, default: () => new Date() }
  },
  { _id: false }
);

const clubSchema = new Schema(
  {
    clubId: { type: Number, required: true },
    country: { type: Number, required: true },
    training: {
      GK: { type: Number, default: null },
      DEF: { type: Number, default: null },
      MID: { type: Number, default: null },
      ATT: { type: Number, default: null }
    },
    name: { type: String, required: true, trim: true },
    gameWeek: { type: Number, default: null },
    week: { type: Number, default: null },
    lastSnapshotDate: { type: Date, default: null },
    sourceType: { type: String, default: null },
    observedAt: { type: Date, default: null },
    settings: {
      currency: {
        type: {
          name: { type: String, required: true },
          rate: { type: Number, required: true }
        },
        _id: false,
        required: true
      },
      week: { type: Number, default: null },
      assumptions: { type: [manualRecordSchema], default: [] },
      preferences: { 
        type: [manualRecordSchema], 
        default: () => [
          { key: "economy.riskTolerance", value: "balanced", updatedAt: new Date() },
          { key: "training.priority", value: "balanced", updatedAt: new Date() },
          { key: "academy.investment", value: "balanced", updatedAt: new Date() },
          { key: "market.strategy", value: "balanced", updatedAt: new Date() }
        ] 
      }
    }
  },
  { timestamps: true }
);

clubSchema.index(
  { clubId: 1 },
  { unique: true }
);

export type ClubDocument = InferSchemaType<typeof clubSchema>;

export const ClubModel =
  (mongoose.models.Club as Model<ClubDocument> | undefined) ??
  model<ClubDocument>("Club", clubSchema);
