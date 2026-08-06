import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

const clubSchema = new Schema(
  {
    externalId: { type: String, default: null },
    name: { type: String, required: true, trim: true }
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
