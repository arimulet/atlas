import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const clubSchema = new Schema(
  {
    externalId: { type: String, default: null, index: true },
    name: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

type ClubDocument = InferSchemaType<typeof clubSchema>;

export const ClubModel = (models.Club as Model<ClubDocument> | undefined) ?? model<ClubDocument>("Club", clubSchema);
