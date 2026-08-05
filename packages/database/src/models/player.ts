import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const playerSchema = new Schema(
  {
    externalId: { type: String, default: null, index: true },
    name: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

type PlayerDocument = InferSchemaType<typeof playerSchema>;

export const PlayerModel =
  (models.Player as Model<PlayerDocument> | undefined) ?? model<PlayerDocument>("Player", playerSchema);
