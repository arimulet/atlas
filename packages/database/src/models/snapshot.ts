import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const moneySchema = new Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: null }
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
    playerId: { type: Schema.Types.ObjectId, ref: "Player", default: null },
    externalId: { type: String, default: null },
    name: { type: String, required: true },
    age: { type: Number, required: true, min: 1 },
    wage: { type: moneySchema, required: true },
    estimatedValue: { type: moneySchema, required: true },
    form: { type: Number, default: null },
    availabilityStatus: {
      type: String,
      enum: ["available", "injured", "suspended", "unknown", null],
      default: null
    },
    observedPosition: { type: String, default: null },
    skills: { type: skillSetSchema, required: true },
    roles: [{ type: String }]
  },
  { _id: true }
);

const snapshotSchema = new Schema(
  {
    clubId: { type: Schema.Types.ObjectId, ref: "Club", required: true, index: true },
    schemaVersion: { type: String, required: true },
    snapshotDate: { type: Date, required: true, index: true },
    season: { type: Number, default: null },
    week: { type: Number, default: null },
    importedAt: { type: Date, required: true, default: () => new Date() },
    source: {
      type: {
        type: String,
        required: true
      },
      exportedAt: { type: Date, required: true },
      pageUrl: { type: String, default: null },
      locale: { type: String, default: null }
    },
    sourceVersion: { type: String, default: null },
    players: [playerSnapshotSchema]
  },
  { timestamps: true }
);

type SnapshotDocument = InferSchemaType<typeof snapshotSchema>;

export const SnapshotModel =
  (models.Snapshot as Model<SnapshotDocument> | undefined) ?? model<SnapshotDocument>("Snapshot", snapshotSchema);
