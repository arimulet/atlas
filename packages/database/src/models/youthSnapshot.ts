import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

const moneySchema = new Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: null }
  },
  { _id: false }
);

const youthPlayerSchema = new Schema(
  {
    externalId: { type: String, default: null },
    name: { type: String, required: true },
    age: { type: Number, required: true, min: 1 },
    initialWeeksRemaining: { type: Number, default: null },
    weeksInAcademy: { type: Number, default: null },
    weeksRemaining: { type: Number, default: null },
    estimatedLevel: { type: String, default: null },
    status: {
      type: String,
      enum: ["in_academy", "ready_for_promotion", "promoted"],
      default: "in_academy"
    }
  },
  { _id: true }
);

const youthSnapshotSchema = new Schema(
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
    weeklyInvestment: { type: moneySchema, default: null },
    players: [youthPlayerSchema]
  },
  { timestamps: true }
);

youthSnapshotSchema.index({ clubId: 1, snapshotDate: 1 });

type YouthSnapshotDocument = InferSchemaType<typeof youthSnapshotSchema>;

export const YouthSnapshotModel =
  (mongoose.models.YouthSnapshot as Model<YouthSnapshotDocument> | undefined) ??
  model<YouthSnapshotDocument>("YouthSnapshot", youthSnapshotSchema);

export const YouthAcademySnapshotModel = YouthSnapshotModel;
