import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";
import { ensureMongooseModels } from "./mongoose-model-registry.js";

ensureMongooseModels();

const trainingWeekSchema = new Schema(
  {
    clubId: { type: Number, required: true, min: 1, index: true },
    playerId: { type: Number, required: true, min: 1, index: true },
    gameWeek: { type: Number, required: true, min: 1 },
    season: { type: Number, default: null },
    seasonWeek: { type: Number, required: true, min: 1 },
    date: { type: Date, required: true },
    type: {
      type: String,
      enum: [
        "general",
        "stamina",
        "keeper",
        "playmaking",
        "passing",
        "technique",
        "defending",
        "striker",
        "pace"
      ],
      required: true
    },
    kind: { type: String, enum: ["advanced", "formation", "missing"], required: true },
    intensity: { type: Number, required: true, min: 0, max: 100 },
    age: { type: Number, required: true, min: 16 },
    skillsChange: { type: Schema.Types.Mixed, required: true }
  },
  { timestamps: true }
);

trainingWeekSchema.index({ clubId: 1, playerId: 1, gameWeek: 1 }, { unique: true });

export type TrainingWeekDocument = InferSchemaType<typeof trainingWeekSchema>;

export const TrainingWeekModel =
  (mongoose.models?.TrainingWeek as Model<TrainingWeekDocument> | undefined) ??
  model<TrainingWeekDocument>("TrainingWeek", trainingWeekSchema);
