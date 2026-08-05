import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

const playerSchema = new Schema(
  {
    externalId: { type: String, default: null },
    name: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

playerSchema.index(
  { externalId: 1 },
  {
    unique: true,
    partialFilterExpression: { externalId: { $type: "string" } }
  }
);

type PlayerDocument = InferSchemaType<typeof playerSchema>;

export const PlayerModel =
  (mongoose.models.Player as Model<PlayerDocument> | undefined) ??
  model<PlayerDocument>("Player", playerSchema);
