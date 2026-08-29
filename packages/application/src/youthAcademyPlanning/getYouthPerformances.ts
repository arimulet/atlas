import { MongoJuniorMatchRepository, MongoClubRepository } from "@atlas/database";
import type { YouthMatchPerformancesDto, YouthPlayerMatchPerformanceDto } from "./youthMatchPerformancesTypes.js";

function isBetterPerformance(current: { rating: number; minutes: number } | null, newRating: number, newMinutes: number): boolean {
  if (!current) return true;
  
  const currentFull = current.minutes >= 60;
  const newFull = newMinutes >= 60;
  
  if (newFull && !currentFull) return true;
  if (currentFull && !newFull) return false;
  
  return newRating > current.rating;
}

function calculatePosition(p: YouthPlayerMatchPerformanceDto): "GK" | "DEF" | "MID" | "ATT" | null {
  if (p.gk.length > 0) return "GK";

  const candidates: Array<{ pos: "DEF" | "MID" | "ATT"; rating: number }> = [];
  if (p.def && p.def.rating >= 20) candidates.push({ pos: "DEF", rating: p.def.rating });
  if (p.mid && p.mid.rating >= 20) candidates.push({ pos: "MID", rating: p.mid.rating });
  if (p.att && p.att.rating >= 20) candidates.push({ pos: "ATT", rating: p.att.rating });

  if (candidates.length === 0) return null;

  return candidates.sort((a, b) => b.rating - a.rating)[0]?.pos ?? null;
}

export async function getYouthPerformances(
  clubId: string,
  juniorMatchesRepo = new MongoJuniorMatchRepository(),
  clubRepo = new MongoClubRepository()
): Promise<YouthMatchPerformancesDto> {
  const club = await clubRepo.findById(clubId);
  if (!club) throw new Error("Club not found");
  const clubNumericId = club.clubId;

  const matches = await juniorMatchesRepo.findByClubId(clubNumericId);
  
  const players: Record<string, YouthPlayerMatchPerformanceDto> = {};

  for (const match of matches) {
    if (!match.playerStats) continue;
    for (const stats of match.playerStats) {
      if (stats.rating === 0) continue; // Ignore players that played but got 0 rating

      const jid = String(stats.playerId);
      if (!players[jid]) {
        players[jid] = {
          juniorId: stats.playerId,
          calculatedPosition: null,
          gk: [],
          def: null,
          mid: null,
          att: null
        };
      }
      
      const p = players[jid];
      const pos = stats.position;
      
      if (pos === 0) {
        if (stats.minutesPlayed > 0) {
          p.gk.push({ rating: stats.rating, minutes: stats.minutesPlayed });
        }
      } else if (pos === 1) {
        if (isBetterPerformance(p.def, stats.rating, stats.minutesPlayed)) {
          p.def = { rating: stats.rating, minutes: stats.minutesPlayed };
        }
      } else if (pos === 2) {
        if (isBetterPerformance(p.mid, stats.rating, stats.minutesPlayed)) {
          p.mid = { rating: stats.rating, minutes: stats.minutesPlayed };
        }
      } else if (pos === 3) {
        if (isBetterPerformance(p.att, stats.rating, stats.minutesPlayed)) {
          p.att = { rating: stats.rating, minutes: stats.minutesPlayed };
        }
      }
    }
  }

  for (const p of Object.values(players)) {
    p.calculatedPosition = calculatePosition(p);
  }

  return {
    clubId,
    players
  };
}