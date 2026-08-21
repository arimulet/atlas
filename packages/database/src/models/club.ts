import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";
import { ensureMongooseModels } from "./mongoose-model-registry.js";

ensureMongooseModels();

const manualRecordSchema = new Schema(
  {
    key: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
    updatedAt: { type: Date, required: true, default: () => new Date() }
  },
  { _id: false }
);

const staffTrainerSchema = new Schema(
  {
    trainerId: { type: Number, required: true, min: 1 },
    name: { type: String, required: true, trim: true },
    assignment: { type: String, enum: ["HEAD", "ASSISTANT", "YOUTH"], required: true },
    contracted: { type: Boolean, required: true },
    salary: { type: Number, required: true, min: 0 },
    age: { type: Number, required: true, min: 1 },
    skills: { type: Schema.Types.Mixed, required: true },
    averageEffectivenessPercent: { type: Number, required: true, min: 0, max: 100 },
    status: { type: String, required: true },
    active: { type: Boolean, required: true }
  },
  { _id: false }
);

const clubTrainingSchema = new Schema(
  {
    GK: { type: Number, required: true },
    DEF: { type: Number, required: true },
    MID: { type: Number, required: true },
    ATT: { type: Number, required: true }
  },
  { _id: false }
);

const clubSchema = new Schema(
  {
    clubId: { type: Number, required: true },
    country: { type: Number, required: true },
    training: { type: clubTrainingSchema, required: true },
    name: { type: String, required: true, trim: true },
    gameWeek: { type: Number, default: null },
    week: { type: Number, default: null },
    budget: { type: Number, default: null },
    currency: { type: String, required: true, trim: true },
    staff: { type: [staffTrainerSchema], default: [] },
    lastSnapshotDate: { type: Date, default: null },
    observedAt: { type: Date, default: null },
    settings: {
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

clubSchema.index({ clubId: 1 }, { unique: true });

export type ClubDocument = InferSchemaType<typeof clubSchema>;

export const ClubModel =
  (mongoose.models?.Club as Model<ClubDocument> | undefined) ??
  model<ClubDocument>("Club", clubSchema);
