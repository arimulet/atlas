import { MongoMatchRepository, type PersistedMatch, type SaveMatchInput } from "@atlas/database";
import {
  calculateMatchPlayerMinutes,
  classifyMatchPlayerRole,
  classifyMatchType,
  normalizeMatchFormation,
  normalizeSeasonWeek,
  type Match,
  type MatchPlayerAppearance,
  type MatchSide
} from "@atlas/domain";
import {
  SokkerHttpClient,
  type SokkerAuthResult,
  type SokkerCredentials
} from "../sokker/sokker-http-client.js";
import {
  parseSokkerLeagueXml,
  parseSokkerMatchDetailXml,
  parseSokkerMatchesXml,
  type SokkerLeagueInfo,
  type SokkerMatchPlayerStats,
  type SokkerMatchSummary
} from "./sokker-match-parser.js";

export interface SokkerMatchesXmlClient {
  login(credentials: SokkerCredentials): Promise<SokkerAuthResult>;
  fetchXml(filename: string, sessionId: string): Promise<string>;
}

export interface MatchRepository {
  exists(matchId: number): Promise<boolean>;
  save(input: SaveMatchInput): Promise<PersistedMatch>;
}

export interface ImportClubMatchesInput {
  clubId: number;
  credentials: SokkerCredentials;
}

export interface ImportClubMatchesResult {
  discovered: number;
  finished: number;
  imported: number;
  skipped: number;
  failed: number;
}

export interface ImportClubMatchesDependencies {
  xmlClient: SokkerMatchesXmlClient;
  matchRepository: MatchRepository;
}

export class ImportClubMatchesUseCase {
  constructor(private readonly dependencies: ImportClubMatchesDependencies) {}

  async execute(input: ImportClubMatchesInput): Promise<ImportClubMatchesResult> {
    const auth = await this.dependencies.xmlClient.login(input.credentials);
    const matchesXml = await this.dependencies.xmlClient.fetchXml(
      `matches-team-${input.clubId}.xml`,
      auth.sessionId
    );
    const matches = parseSokkerMatchesXml(matchesXml);
    const finishedMatches = matches.filter((match) => match.isFinished);
    const leagueCache = new Map<number, SokkerLeagueInfo>();
    const result: ImportClubMatchesResult = {
      discovered: matches.length,
      finished: finishedMatches.length,
      imported: 0,
      skipped: 0,
      failed: 0
    };

    for (const match of finishedMatches) {
      if (await this.dependencies.matchRepository.exists(match.id)) {
        result.skipped += 1;
        continue;
      }

      try {
        const detailXml = await this.dependencies.xmlClient.fetchXml(
          `match-${match.id}.xml`,
          auth.sessionId
        );
        const playerStats = parseSokkerMatchDetailXml(detailXml, input.clubId);
        let league = leagueCache.get(match.leagueId);

        if (!league) {
          const leagueXml = await this.dependencies.xmlClient.fetchXml(
            `league-${match.leagueId}.xml`,
            auth.sessionId
          );
          league = parseSokkerLeagueXml(leagueXml);
          leagueCache.set(match.leagueId, league);
        }

        const normalized = normalizeMatchForClub(input.clubId, match, league, playerStats);
        await this.dependencies.matchRepository.save(toSaveMatchInput(normalized));
        result.imported += 1;
      } catch {
        result.failed += 1;
      }
    }

    return result;
  }
}

export async function importClubMatches(
  input: ImportClubMatchesInput,
  dependencies: ImportClubMatchesDependencies = {
    xmlClient: new SokkerHttpClient(),
    matchRepository: new MongoMatchRepository()
  }
): Promise<ImportClubMatchesResult> {
  return new ImportClubMatchesUseCase(dependencies).execute(input);
}

export function normalizeMatchForClub(
  clubId: number,
  summary: SokkerMatchSummary,
  league: SokkerLeagueInfo,
  playerStats: SokkerMatchPlayerStats[]
): Match {
  if (!summary.playedAt) {
    throw new Error(`Finished match ${summary.id} does not have a valid played date.`);
  }

  const ownerIsHome = summary.homeTeamId === clubId;
  const ownerIsAway = summary.awayTeamId === clubId;

  if (ownerIsHome === ownerIsAway) {
    throw new Error(`Club ${clubId} is not uniquely present in match ${summary.id}.`);
  }

  const side: MatchSide = ownerIsHome ? "HOME" : "AWAY";
  const opponent = ownerIsHome
    ? { id: summary.awayTeamId, name: summary.awayTeamName }
    : { id: summary.homeTeamId, name: summary.homeTeamName };
  const score = ownerIsHome
    ? { club: summary.homeScore, opponent: summary.awayScore }
    : { club: summary.awayScore, opponent: summary.homeScore };
  const players = playerStats.map(normalizeMatchPlayer);

  return {
    id: summary.id,
    clubId,
    gameWeek: summary.gameWeek,
    week: normalizeSeasonWeek(summary.gameWeek),
    playedAt: summary.playedAt,
    leagueId: league.id,
    matchType: classifyMatchType(league),
    side,
    opponent,
    score,
    players
  };
}

function normalizeMatchPlayer(player: SokkerMatchPlayerStats): MatchPlayerAppearance {
  const participation = {
    timeIn: player.timeIn,
    timeOut: player.timeOut,
    rating: player.rating,
    timePlaying: player.timePlaying,
    timeDefending: player.timeDefending
  };

  return {
    playerId: player.playerId,
    number: player.number,
    formation: normalizeMatchFormation(player.formation),
    role: classifyMatchPlayerRole(participation),
    timeIn: player.timeIn,
    timeOut: player.timeOut,
    minutesPlayed: calculateMatchPlayerMinutes(participation)
  };
}

function toSaveMatchInput(match: Match): SaveMatchInput {
  return {
    id: match.id,
    clubId: match.clubId,
    gameWeek: match.gameWeek,
    week: match.week,
    playedAt: match.playedAt,
    leagueId: match.leagueId,
    matchType: match.matchType,
    side: match.side,
    opponent: match.opponent,
    score: match.score,
    players: match.players
  };
}
