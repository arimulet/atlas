import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

const playerDevelopmentTargetSchema = new Schema(
  {
    playerId: { type: Number, required: true, min: 1 },
    clubId: { type: Number, required: true, min: 1 },
    profile: {
      type: String,
      enum: [
        "goalkeeper",
        "central_defender",
        "wing_defender",
        "central_midfielder",
        "winger",
        "forward"
      ],
      default: null
    },
    targetLevels: { type: Map, of: Number, default: {} },
    targetAge: { type: Number, default: null, min: 1 }
  },
  { timestamps: true }
);

playerDevelopmentTargetSchema.index({ clubId: 1, playerId: 1 }, { unique: true });

type PlayerDevelopmentTargetDocument = InferSchemaType<typeof playerDevelopmentTargetSchema>;

export function getPlayerDevelopmentTargetModel(): Model<PlayerDevelopmentTargetDocument> {
  return (
    (mongoose.models.PlayerDevelopmentTarget as
      Model<PlayerDevelopmentTargetDocument> | undefined) ??
    model<PlayerDevelopmentTargetDocument>("PlayerDevelopmentTarget", playerDevelopmentTargetSchema)
  );
}
