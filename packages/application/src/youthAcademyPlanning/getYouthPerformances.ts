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

function calculatePosition(p: YouthPlayerMatchPerformanceDto): "GK" | "DEF" | "MID" | "ATT" | "RELEASE" | null {
  const candidates: Array<{ pos: "GK" | "DEF" | "MID" | "ATT"; rating: number; minutes: number }> = [];
  
  if (p.gk.length > 0) {
    const bestGk = p.gk.reduce((best, current) => {
      const bestFull = best.minutes >= 60;
      const currentFull = current.minutes >= 60;
      if (currentFull && !bestFull) return current;
      if (bestFull && !currentFull) return best;
      return current.rating > best.rating ? current : best;
    }, p.gk[0]!);
    candidates.push({ pos: "GK", rating: bestGk.rating, minutes: bestGk.minutes });
  }

  if (p.def && p.def.rating >= 20) candidates.push({ pos: "DEF", rating: p.def.rating, minutes: p.def.minutes });
  if (p.mid && p.mid.rating >= 20) candidates.push({ pos: "MID", rating: p.mid.rating, minutes: p.mid.minutes });
  if (p.att && p.att.rating >= 20) candidates.push({ pos: "ATT", rating: p.att.rating, minutes: p.att.minutes });

  if (candidates.length > 0) {
    return candidates.sort((a, b) => {
      const aFull = a.minutes >= 60;
      const bFull = b.minutes >= 60;
      if (aFull && !bFull) return -1;
      if (bFull && !aFull) return 1;
      return b.rating - a.rating;
    })[0]?.pos ?? "RELEASE";
  }

  // To be RELEASE, they must have failed to reach 20 in ALL 3 field positions
  if (p.def && p.mid && p.att) return "RELEASE";

  // If they haven't tested all positions yet, return null (Sin pos.)
  return null;
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
