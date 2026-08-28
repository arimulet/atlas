import mongoose, { Schema, model } from "mongoose";
import { ensureMongooseModels } from "./mongoose-model-registry.js";

ensureMongooseModels();

const playerStatsSchema = new Schema(
  {
    playerId: { type: Number, required: true },
    position: { type: Number, default: null },
    minutesPlayed: { type: Number, required: true },
    rating: { type: Number, required: true },
    goals: { type: Number, required: true },
    assists: { type: Number, required: true },
    shoots: { type: Number, required: true },
    fouls: { type: Number, required: true },
    yellowCards: { type: Number, required: true },
    redCards: { type: Number, required: true },
    isInjured: { type: Boolean, required: true },
    timeDefending: { type: Number, required: true },
  },
  { _id: false }
);

const juniorMatchSchema = new Schema(
  {
    matchId: { type: Number, required: true },
    clubId: { type: Number, required: true },
    season: { type: Number, required: true },
    gameWeek: { type: Number, required: true },
    seasonWeek: { type: Number, required: true },
    dateExpected: { type: Date, required: true },
    isFinished: { type: Boolean, required: true },
    playerStats: [playerStatsSchema],
  },
  { timestamps: true }
);

juniorMatchSchema.index({ matchId: 1 }, { unique: true });
juniorMatchSchema.index({ clubId: 1, season: -1, seasonWeek: -1 });

export const JuniorMatchModel = (
  mongoose.models?.JuniorMatch ?? 
  model("JuniorMatch", juniorMatchSchema, "junior_matches")
) as any;
