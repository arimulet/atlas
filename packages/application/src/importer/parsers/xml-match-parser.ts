import { XMLParser } from "fast-xml-parser";
import type { JuniorMatchPlayerStatsDto } from "../types.js";

/**
 * Parses match XML and match lineup to extract player stats for junior players.
 * Junior players are identified by a negative playerId in the XML.
 */
export function parseJuniorMatchXml(
  xmlData: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lineup: { homePlayers: any[]; awayPlayers: any[] }
): JuniorMatchPlayerStatsDto[] {
  const parser = new XMLParser({
    ignoreAttributes: false, // Keep attributes, they are crucial in Sokker XML
    attributeNamePrefix: "", // No prefix so p.playerID works for both <playerID> and attribute playerID=""
    parseTagValue: true
  });

  const parsed = parser.parse(xmlData);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allPlayerStats: any[] = [];

  // Recursively find any object that represents a player stat (has playerID or ID)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function findPlayers(obj: any) {
    if (!obj) return;
    if (Array.isArray(obj)) {
      obj.forEach(findPlayers);
    } else if (typeof obj === "object") {
      // Sokker XML player stats usually have playerID or id
      if (obj.playerID !== undefined || obj.playerId !== undefined || obj.id !== undefined) {
        // Only include if it has match-related stat fields to distinguish from generic player info
        if (obj.timeIn !== undefined || obj.rating !== undefined || obj.minutes !== undefined || obj.isInjured !== undefined || obj.goals !== undefined) {
          allPlayerStats.push(obj);
        }
      }
      for (const key of Object.keys(obj)) {
        findPlayers(obj[key]);
      }
    }
  }

  findPlayers(parsed);

  // Combine lineup players to find position
  const allLineupPlayers = [...(lineup.homePlayers || []), ...(lineup.awayPlayers || [])];

  const juniorStats: JuniorMatchPlayerStatsDto[] = [];

  for (const p of allPlayerStats) {
    const rawPlayerId = Number(p.playerID ?? p.playerId ?? p.id);
    if (!isNaN(rawPlayerId) && rawPlayerId < 0) {
      const playerId = Math.abs(rawPlayerId);
      
      const timeIn = Number(p.timeIn) || 0;
      const timeOut = Number(p.timeOut) || 0;
      
      let minutes = 0;
      if (timeIn === 0 && timeOut === 0) {
        minutes = 90;
      } else if (timeOut > 0) {
        minutes = timeOut - timeIn;
      } else if (timeIn > 0) {
        minutes = 90 - timeIn;
      }

      // Map position from lineup (the lineup usually uses the positive ID for juniors via youthTeamId, but we might need to check negative or positive)
      const lineupPlayer = allLineupPlayers.find(lp => {
        if (!lp) return false;
        const ids = [
          lp.id, lp.info?.id, lp.youthTeamId, lp.player?.id, lp.playerId
        ].map(id => Number(id)).filter(id => !isNaN(id));
        return ids.includes(playerId) || ids.includes(rawPlayerId);
      });

      let position: number | null = null;
      if (lineupPlayer) {
        if (lineupPlayer.formation?.code !== undefined && lineupPlayer.formation?.code !== null) {
          position = Number(lineupPlayer.formation.code);
        } else if (lineupPlayer.position?.code !== undefined && lineupPlayer.position?.code !== null) {
          position = Number(lineupPlayer.position.code);
        } else if (typeof lineupPlayer.formation === 'number') {
          position = lineupPlayer.formation;
        } else if (typeof lineupPlayer.formation === 'string') {
          const map: Record<string, number> = { "GK": 0, "DEF": 1, "MID": 2, "ATT": 3 };
          position = map[lineupPlayer.formation.toUpperCase()] ?? null;
        } else if (typeof lineupPlayer.position === 'number') {
          position = lineupPlayer.position;
        }
      }

      // Fallback to XML properties if JSON lineup didn't have it or didn't match
      if (position === null) {
        const xmlFormation = p.formation ?? p.position ?? p.formationCode ?? p.positionCode ?? p.pos;
        if (xmlFormation !== undefined && xmlFormation !== null) {
          if (typeof xmlFormation === 'number') {
            position = xmlFormation;
          } else if (typeof xmlFormation === 'string') {
            const num = Number(xmlFormation);
            if (!isNaN(num)) {
              position = num;
            } else {
              const map: Record<string, number> = { "GK": 0, "DEF": 1, "MID": 2, "ATT": 3 };
              position = map[xmlFormation.toUpperCase()] ?? null;
            }
          }
        }
      }

      juniorStats.push({
        playerId,
        position,
        minutesPlayed: minutes,
        rating: Number(p.rating) || 0,
        goals: Number(p.goals) || 0,
        assists: Number(p.assists) || 0,
        shoots: Number(p.shoots) || 0,
        fouls: Number(p.fouls) || 0,
        yellowCards: Number(p.yellowCards) || 0,
        redCards: Number(p.redCards) || 0,
        isInjured: Number(p.isInjured) === 1,
        timeDefending: Number(p.timeDefending) || 0
      });
    }
  }

  return juniorStats;
}
