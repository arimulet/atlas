import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

const clubSnapshotSchema = new Schema(
  {
    teamId: { type: Number, required: true, min: 1 },
    gameWeek: { type: Number, required: true, min: 1 },
    season: { type: Number, required: true, min: 1 },
    seasonWeek: { type: Number, required: true, min: 1 },
    date: { type: Date, required: true },
    team: {
      id: { type: Number, required: true, min: 1 },
      name: { type: String, required: true },
      rank: { type: Number, required: true },
      rankPosition: { type: Number, required: true },
      country: {
        code: { type: Number, required: true },
        name: { type: String, required: true }
      },
      bankrupt: { type: Boolean, required: true }
    },
    budget: {
      value: { type: Number, required: true },
      currency: { type: String, required: true }
    }
  },
  { timestamps: true }
);

clubSnapshotSchema.index({ teamId: 1, gameWeek: 1 }, { unique: true });

export type ClubSnapshotDocument = InferSchemaType<typeof clubSnapshotSchema>;

export const ClubSnapshotModel =
  (mongoose.models.ClubSnapshot as Model<ClubSnapshotDocument> | undefined) ??
  model<ClubSnapshotDocument>("ClubSnapshot", clubSnapshotSchema);
