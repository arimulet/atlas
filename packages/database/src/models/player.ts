import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

const playerSchema = new Schema(
  {
    playerId: { type: Number, required: true, min: 1 },
    name: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

playerSchema.index(
  { playerId: 1 },
  {
    unique: true
  }
);

type PlayerDocument = InferSchemaType<typeof playerSchema>;

export const PlayerModel =
  (mongoose.models.Player as Model<PlayerDocument> | undefined) ??
  model<PlayerDocument>("Player", playerSchema);
