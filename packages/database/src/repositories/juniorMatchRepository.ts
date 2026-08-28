import { type ClientSession } from "mongoose";
import { JuniorMatchModel } from "../models/juniorMatch.js";
import type { PersistedJuniorMatch } from "./types.js";

export class MongoJuniorMatchRepository {
  async save(match: PersistedJuniorMatch, session?: ClientSession): Promise<void> {
    await JuniorMatchModel.findOneAndUpdate(
      { matchId: match.matchId },
      {
        $set: {
          clubId: match.clubId,
          season: match.season,
          gameWeek: match.gameWeek,
          seasonWeek: match.seasonWeek,
          dateExpected: match.dateExpected,
          isFinished: match.isFinished,
          playerStats: match.playerStats
        }
      },
      { upsert: true, runValidators: true, session }
    );
  }

  async findByMatchId(matchId: number): Promise<PersistedJuniorMatch | null> {
    const match = await JuniorMatchModel.findOne({ matchId }).lean();
    if (!match) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.mapJuniorMatch(match as any);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapJuniorMatch(match: any): PersistedJuniorMatch {
    return {
      id: match._id.toString(),
      matchId: match.matchId,
      clubId: match.clubId,
      season: match.season,
      gameWeek: match.gameWeek,
      seasonWeek: match.seasonWeek,
      dateExpected: match.dateExpected,
      isFinished: match.isFinished,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      playerStats: (match.playerStats || []).map((p: any) => ({
        playerId: p.playerId,
        position: p.position,
        minutesPlayed: p.minutesPlayed,
        rating: p.rating,
        goals: p.goals,
        assists: p.assists,
        shoots: p.shoots,
        fouls: p.fouls,
        yellowCards: p.yellowCards,
        redCards: p.redCards,
        isInjured: p.isInjured,
        timeDefending: p.timeDefending
      }))
    };
  }
}
