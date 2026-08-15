import { MatchModel } from "../models/match.js";
import type { PersistedMatch, SaveMatchInput } from "./types.js";

export class MongoMatchRepository {
  async exists(matchId: number): Promise<boolean> {
    return (await MatchModel.exists({ matchId })) !== null;
  }

  async save(input: SaveMatchInput): Promise<PersistedMatch> {
    const match = await MatchModel.findOneAndUpdate(
      { matchId: input.id },
      {
        $setOnInsert: {
          matchId: input.id,
          clubId: input.clubId,
          gameWeek: input.gameWeek,
          week: input.week,
          playedAt: input.playedAt,
          leagueId: input.leagueId,
          matchType: input.matchType,
          side: input.side,
          opponent: input.opponent,
          score: input.score,
          players: input.players
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (!match) {
      throw new Error(`Match could not be persisted: ${input.id}.`);
    }

    return mapMatch(match.toObject());
  }

  async findById(matchId: number): Promise<PersistedMatch | null> {
    const match = await MatchModel.findOne({ matchId });
    return match ? mapMatch(match.toObject()) : null;
  }

  async listByClub(clubId: number): Promise<PersistedMatch[]> {
    const matches = await MatchModel.find({ clubId }).sort({ playedAt: 1, matchId: 1 });
    return matches.map((match) => mapMatch(match.toObject()));
  }

  async listByClubAndGameWeek(clubId: number, gameWeek: number): Promise<PersistedMatch[]> {
    const matches = await MatchModel.find({ clubId, gameWeek }).sort({ playedAt: 1, matchId: 1 });
    return matches.map((match) => mapMatch(match.toObject()));
  }
}

function mapMatch(match: {
  matchId: number;
  clubId: number;
  gameWeek: number;
  week: number;
  playedAt: Date;
  leagueId: number;
  matchType: PersistedMatch["matchType"];
  side: PersistedMatch["side"];
  opponent?: { id: number; name: string } | null;
  score?: { club: number; opponent: number } | null;
  players: PersistedMatch["players"];
}): PersistedMatch {
  if (!match.opponent || !match.score) {
    throw new Error(`Match ${match.matchId} has incomplete opponent or score data.`);
  }

  return {
    id: match.matchId,
    clubId: match.clubId,
    gameWeek: match.gameWeek,
    week: match.week,
    playedAt: match.playedAt,
    leagueId: match.leagueId,
    matchType: match.matchType,
    side: match.side,
    opponent: { id: match.opponent.id, name: match.opponent.name },
    score: { club: match.score.club, opponent: match.score.opponent },
    players: match.players.map((player) => ({
      playerId: player.playerId,
      number: player.number,
      formation: player.formation,
      role: player.role,
      timeIn: player.timeIn,
      timeOut: player.timeOut,
      minutesPlayed: player.minutesPlayed
    }))
  };
}
