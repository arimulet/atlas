import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";
import { ensureMongooseModels } from "./mongoose-model-registry.js";

ensureMongooseModels();

const playerSchema = new Schema(
  {
    playerId: { type: Number, required: true, min: 1 },
    clubId: { type: Number, required: true, min: 1 },
    name: { type: String, required: true, trim: true },
    countryId: { type: Number, default: null, min: 1 },
    countryName: { type: String, default: null, trim: true },
    age: { type: Number, default: null, min: 1 },
    position: { type: String, default: null },
    skills: { type: Schema.Types.Mixed, default: {} },
    marketValue: { type: Number, default: null, min: 0 },
    wage: { type: Number, default: null, min: 0 },
    cards: {
      yellow: { type: Number, default: 0, min: 0 },
      red: { type: Number, default: 0, min: 0 }
    },
    injury: {
      days: { type: Number, default: null, min: 0 },
      severe: { type: Boolean, default: null }
    },
    currentGameWeek: { type: Number, default: null, min: 1 }
  },
  { timestamps: true }
);

playerSchema.index(
  { clubId: 1, playerId: 1 },
  {
    unique: true
  }
);

type PlayerDocument = InferSchemaType<typeof playerSchema>;

export const PlayerModel =
  (mongoose.models?.Player as Model<PlayerDocument> | undefined) ??
  model<PlayerDocument>("Player", playerSchema);
