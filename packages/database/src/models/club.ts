import { Schema, model, models } from "mongoose";

const clubSchema = new Schema(
  {
    externalId: { type: String, default: null, index: true },
    name: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

export const ClubModel = models.Club ?? model("Club", clubSchema);
