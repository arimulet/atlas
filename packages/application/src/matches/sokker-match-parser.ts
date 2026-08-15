import { XMLParser } from "fast-xml-parser";
import {
  sokkerLeagueXmlSchema,
  sokkerMatchXmlSchema,
  sokkerMatchesXmlSchema
} from "@atlas/contracts";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_"
});

export interface SokkerMatchSummary {
  id: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  leagueId: number;
  gameWeek: number;
  playedAt: Date | null;
  homeScore: number;
  awayScore: number;
  isFinished: boolean;
}

export interface SokkerMatchPlayerStats {
  playerId: number;
  number: number;
  formation: number;
  timeIn: number;
  timeOut: number;
  rating: number | null;
  timePlaying: number | null;
  timeDefending: number | null;
}

export interface SokkerLeagueInfo {
  id: number;
  name: string;
  type: number;
  isOfficial: boolean;
}

export function parseSokkerMatchesXml(xml: string): SokkerMatchSummary[] {
  const parsed = sokkerMatchesXmlSchema.parse(parser.parse(xml));
  const matches = asArray(parsed.matches.match);

  return matches.map((match) => ({
    id: match.matchID,
    homeTeamId: match.homeTeamID,
    awayTeamId: match.awayTeamID,
    homeTeamName: match.homeTeamName,
    awayTeamName: match.awayTeamName,
    leagueId: match.leagueID,
    gameWeek: match.week,
    playedAt: match.isFinished
      ? parseFinishedMatchDate(match.dateStarted, match.dateExpected)
      : null,
    homeScore: match.homeTeamScore,
    awayScore: match.awayTeamScore,
    isFinished: match.isFinished
  }));
}

export function parseSokkerMatchDetailXml(xml: string, clubId: number): SokkerMatchPlayerStats[] {
  const parsed = sokkerMatchXmlSchema.parse(parser.parse(xml));
  const groups = asArray(parsed.match.playersStats);
  const group = groups.find((playersStats) => playersStats["@_teamID"] === clubId);

  if (!group) {
    throw new Error(`Match detail does not contain playersStats for club ${clubId}.`);
  }

  return asArray(group.playerStats).map((player) => ({
    playerId: player.playerID,
    number: player.number,
    formation: player.formation,
    timeIn: player.timeIn,
    timeOut: player.timeOut,
    rating: player.rating ?? null,
    timePlaying: player.timePlaying ?? null,
    timeDefending: player.timeDefending ?? null
  }));
}

export function parseSokkerLeagueXml(xml: string): SokkerLeagueInfo {
  const parsed = sokkerLeagueXmlSchema.parse(parser.parse(xml));
  const info = parsed.league.info;

  return {
    id: info.leagueID,
    name: info.name,
    type: info.type,
    isOfficial: info.isOfficial
  };
}

export function parseSokkerDate(value: string): Date {
  const normalized = value.trim().replace(" ", "T");
  const hasSeconds = /T\d\d:\d\d:\d\d/.test(normalized);
  const date = new Date(
    /Z$|[+-]\d\d:\d\d$/.test(normalized) ? normalized : `${normalized}${hasSeconds ? "" : ":00"}Z`
  );

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid Sokker date: ${value}.`);
  }

  return date;
}

function parseFinishedMatchDate(
  dateStarted: string | undefined,
  dateExpected: string
): Date | null {
  const candidates = [dateStarted, dateExpected].filter((value): value is string => {
    const trimmedValue = value?.trim();

    if (!trimmedValue) {
      return false;
    }

    return !trimmedValue.startsWith("0000-00-00");
  });

  for (const candidate of candidates) {
    try {
      return parseSokkerDate(candidate);
    } catch {
      continue;
    }
  }

  return null;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}
