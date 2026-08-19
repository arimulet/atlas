import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

const trainingSummarySchema = new Schema(
  {
    teamId: { type: Number, required: true, min: 1 },
    gameWeek: { type: Number, required: true, min: 1 },
    season: { type: Number, required: true, min: 1 },
    seasonWeek: { type: Number, required: true, min: 1 },
    date: { type: Date, required: true },
    players: {
      formationTraining: { type: Number, required: true, min: 0 },
      advancedTraining: { type: Number, required: true, min: 0 },
      skillsUp: { type: Number, required: true, min: 0 }
    },
    juniors: {
      count: { type: Number, required: true, min: 0 },
      skillsUp: { type: Number, required: true, min: 0 }
    }
  },
  { timestamps: true }
);

trainingSummarySchema.index({ teamId: 1, gameWeek: 1 }, { unique: true });

export type TrainingSummaryDocument = InferSchemaType<typeof trainingSummarySchema>;

export const TrainingSummaryModel =
  (mongoose.models.TrainingSummary as Model<TrainingSummaryDocument> | undefined) ??
  model<TrainingSummaryDocument>("TrainingSummary", trainingSummarySchema);
