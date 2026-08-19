import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

const juniorSchema = new Schema(
  {
    teamId: { type: Number, required: true, min: 1 },
    juniorId: { type: Number, required: true, min: 1 },
    name: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      fullName: { type: String, required: true }
    },
    age: { type: Number, required: true },
    currentLevel: { type: Number, required: true },
    weeksLeft: { type: Number, required: true },
    active: { type: Boolean, required: true, default: true }
  },
  { timestamps: true }
);

juniorSchema.index({ teamId: 1, juniorId: 1 }, { unique: true });

export type JuniorDocument = InferSchemaType<typeof juniorSchema>;

export const JuniorModel =
  (mongoose.models.Junior as Model<JuniorDocument> | undefined) ??
  model<JuniorDocument>("Junior", juniorSchema);
