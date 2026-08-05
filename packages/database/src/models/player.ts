import { Schema, model, models } from "mongoose";

const playerSchema = new Schema(
  {
    externalId: { type: String, default: null, index: true },
    name: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

export const PlayerModel = models.Player ?? model("Player", playerSchema);
