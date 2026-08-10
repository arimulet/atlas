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
      gk: { type: Number, default: null },
      def: { type: Number, default: null },
      mid: { type: Number, default: null },
      att: { type: Number, default: null }
    },
    name: { type: String, required: true, trim: true },
    observed: {
      clubId: { type: Number, default: null },
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
  { clubId: 1 },
  { unique: true }
);

type ClubDocument = InferSchemaType<typeof clubSchema>;

export const ClubModel =
  (mongoose.models.Club as Model<ClubDocument> | undefined) ??
  model<ClubDocument>("Club", clubSchema);
