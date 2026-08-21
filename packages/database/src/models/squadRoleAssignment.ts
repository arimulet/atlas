import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";
import { ensureMongooseModels } from "./mongoose-model-registry.js";

ensureMongooseModels();

const squadRoleAssignmentSchema = new Schema(
  {
    playerId: { type: Number, required: true, min: 1 },
    clubId: { type: Number, required: true, min: 1 },
    role: {
      type: String,
      required: true,
      enum: ["core", "developing", "prospect", "rotation", "depth", "transition"]
    }
  },
  { timestamps: true }
);

squadRoleAssignmentSchema.index({ clubId: 1, playerId: 1 }, { unique: true });

type SquadRoleAssignmentDocument = InferSchemaType<typeof squadRoleAssignmentSchema>;

export function getSquadRoleAssignmentModel(): Model<SquadRoleAssignmentDocument> {
  return (
    (mongoose.models?.SquadRoleAssignment as Model<SquadRoleAssignmentDocument> | undefined) ??
    model<SquadRoleAssignmentDocument>("SquadRoleAssignment", squadRoleAssignmentSchema)
  );
}
