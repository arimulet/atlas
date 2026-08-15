import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

const matchPlayerAppearanceSchema = new Schema(
  {
    playerId: { type: Number, required: true, min: 1 },
    number: { type: Number, required: true, min: 0 },
    formation: { type: String, enum: ["GK", "DEF", "MID", "ATT"], required: true },
    role: {
      type: String,
      enum: ["STARTER", "SUBSTITUTE_USED", "SUBSTITUTE_UNUSED"],
      required: true
    },
    timeIn: { type: Number, required: true, min: 0 },
    timeOut: { type: Number, required: true, min: 0 },
    minutesPlayed: { type: Number, required: true, min: 0, max: 90 }
  },
  { _id: false }
);

const matchSchema = new Schema(
  {
    matchId: { type: Number, required: true, min: 1, unique: true, index: true },
    clubId: { type: Number, required: true, min: 1, index: true },
    gameWeek: { type: Number, required: true, min: 1, index: true },
    week: { type: Number, required: true, min: 1 },
    playedAt: { type: Date, required: true, index: true },
    leagueId: { type: Number, required: true, min: 1 },
    matchType: { type: String, enum: ["OFFICIAL", "FRIENDLY", "NOT_ELIGIBLE"], required: true },
    side: { type: String, enum: ["HOME", "AWAY"], required: true },
    opponent: {
      id: { type: Number, required: true, min: 1 },
      name: { type: String, required: true, trim: true }
    },
    score: {
      club: { type: Number, required: true, min: 0 },
      opponent: { type: Number, required: true, min: 0 }
    },
    players: { type: [matchPlayerAppearanceSchema], required: true, default: [] }
  },
  { timestamps: true }
);

matchSchema.index({ clubId: 1, gameWeek: 1 });

export type MatchDocument = InferSchemaType<typeof matchSchema>;

export const MatchModel =
  (mongoose.models.Match as Model<MatchDocument> | undefined) ??
  model<MatchDocument>("Match", matchSchema);
