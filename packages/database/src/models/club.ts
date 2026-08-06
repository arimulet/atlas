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
    externalId: { type: String, default: null },
    name: { type: String, required: true, trim: true },
    observed: {
      externalId: { type: String, default: null },
      name: { type: String, required: true, trim: true },
      season: { type: Number, default: null },
      week: { type: Number, default: null },
      lastSnapshotDate: { type: Date, default: null },
      sourceType: { type: String, default: null },
      observedAt: { type: Date, default: null }
    },
    manual: {
      name: { type: String, default: null },
      currency: { type: String, default: null },
      season: { type: Number, default: null },
      week: { type: Number, default: null },
      assumptions: { type: [manualRecordSchema], default: [] },
      preferences: { type: [manualRecordSchema], default: [] }
    }
  },
  { timestamps: true }
);

clubSchema.index(
  { externalId: 1 },
  {
    unique: true,
    partialFilterExpression: { externalId: { $type: "string" } }
  }
);

type ClubDocument = InferSchemaType<typeof clubSchema>;

export const ClubModel =
  (mongoose.models.Club as Model<ClubDocument> | undefined) ??
  model<ClubDocument>("Club", clubSchema);
