import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

const trainerSchema = new Schema(
  {
    teamId: { type: Number, required: true, min: 1 },
    trainerId: { type: Number, required: true, min: 1 },
    name: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      fullName: { type: String, required: true }
    },
    assignment: { type: String, enum: ["HEAD", "ASSISTANT", "YOUTH"], required: true },
    contracted: { type: Boolean, required: true },
    salary: {
      value: { type: Number, required: true },
      currency: { type: String, required: true }
    },
    age: { type: Number, required: true },
    skills: { type: Schema.Types.Mixed, required: true },
    averageEffectivenessPercent: { type: Number, required: true, min: 0, max: 100 },
    status: { type: String, required: true },
    active: { type: Boolean, required: true, default: true }
  },
  { timestamps: true }
);

trainerSchema.index({ teamId: 1, trainerId: 1 }, { unique: true });

export type TrainerDocument = InferSchemaType<typeof trainerSchema>;

export const TrainerModel =
  (mongoose.models.Trainer as Model<TrainerDocument> | undefined) ??
  model<TrainerDocument>("Trainer", trainerSchema);
