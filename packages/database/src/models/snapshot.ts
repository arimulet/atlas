import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";
import { ensureMongooseModels } from "./mongoose-model-registry.js";

ensureMongooseModels();

const observedPositionValues = [
  "goalkeeper",
  "defender",
  "midfielder",
  "winger",
  "striker"
] as const;

const trainingSchema = new Schema(
  {
    position: { type: Number, required: true, min: 0 },
    advanced: { type: Boolean, required: true }
  },
  { _id: false }
);

const skillSetSchema = new Schema(
  {
    stamina: { type: Number, default: null },
    pace: { type: Number, default: null },
    technique: { type: Number, default: null },
    passing: { type: Number, default: null },
    keeper: { type: Number, default: null },
    defender: { type: Number, default: null },
    playmaker: { type: Number, default: null },
    striker: { type: Number, default: null }
  },
  { _id: false }
);

const playerSnapshotSchema = new Schema(
  {
    playerId: { type: Number, required: true, min: 1 },
    age: { type: Number, required: true, min: 1 },
    wage: { type: Number, required: true, min: 0 },
    value: { type: Number, required: true, min: 0 },
    form: { type: Number, default: null },
    availabilityStatus: {
      type: String,
      enum: ["available", "injured", "suspended", "unknown", null],
      default: null
    },
    observedPosition: { type: String, enum: [...observedPositionValues, null], default: null },
    skills: { type: skillSetSchema, required: true },

    training: { type: trainingSchema, required: true }
  },
  { _id: true }
);

const juniorSnapshotSchema = new Schema(
  {
    playerId: { type: Number, required: true, min: 1 },
    name: { type: String, required: true, trim: true },
    age: { type: Number, required: true, min: 1 },
    initialLevel: { type: Number, default: null, min: 0 },
    initialWeeksRemaining: { type: Number, default: null },
    weeksRemaining: { type: Number, default: null },
    skill: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["in_academy", "ready_for_promotion", "promoted"],
      default: "in_academy"
    }
  },
  { _id: true }
);

const snapshotSchema = new Schema(
  {
    clubId: { type: Schema.Types.ObjectId, ref: "Club", required: true, index: true },
    schemaVersion: { type: String, required: true },
    snapshotDate: { type: Date, required: true, index: true },
    gameWeek: { type: Number, default: null },
    week: { type: Number, default: null },
    naturalKey: { type: String, default: null },
    importedAt: { type: Date, required: true, default: () => new Date() },
    players: [playerSnapshotSchema],
    juniors: [juniorSnapshotSchema]
  },
  { timestamps: true }
);

snapshotSchema.index({ clubId: 1, snapshotDate: 1 });
snapshotSchema.index(
  { clubId: 1, gameWeek: 1, naturalKey: 1 },
  { unique: true, partialFilterExpression: { naturalKey: { $type: "string" } } }
);

type SnapshotDocument = InferSchemaType<typeof snapshotSchema>;

export const SnapshotModel =
  (mongoose.models?.Snapshot as Model<SnapshotDocument> | undefined) ??
  model<SnapshotDocument>("Snapshot", snapshotSchema);
