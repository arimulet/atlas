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
import type { SokkerCredentials } from "../importer/types.js";
import { SokkerXmlProvider } from "../importer/providers/xml/SokkerXmlProvider.js";
import type {
  SokkerLeagueDto,
  SokkerMatchPlayerStatsDto,
  SokkerMatchSummaryDto,
  SokkerDataProvider
} from "../importer/index.js";

export type SokkerMatchDataProvider = Pick<
  SokkerDataProvider,
  "getMatches" | "getMatchLineup" | "getLeague"
>;

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
  dataProvider?: SokkerMatchDataProvider;
  matchRepository: MatchRepository;
}

export class ImportClubMatchesUseCase {
  constructor(private readonly dependencies: ImportClubMatchesDependencies) {}

  async execute(input: ImportClubMatchesInput): Promise<ImportClubMatchesResult> {
    const provider = await this.resolveProvider(input.credentials);
    const matches = await provider.getMatches(input.clubId);
    const finishedMatches = matches.filter((match) => match.isFinished);
    const leagueCache = new Map<number, SokkerLeagueDto>();
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
        const playerStats = await provider.getMatchLineup(match.id, input.clubId);
        let league = leagueCache.get(match.leagueId);

        if (!league) {
          league = await provider.getLeague(match.leagueId);
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

  private async resolveProvider(credentials: SokkerCredentials): Promise<SokkerMatchDataProvider> {
    if (this.dependencies.dataProvider) {
      return this.dependencies.dataProvider;
    }

    const provider = new SokkerXmlProvider(credentials);
    await provider.login();

    return provider;
  }
}

export async function importClubMatches(
  input: ImportClubMatchesInput,
  dependencies: ImportClubMatchesDependencies = { matchRepository: new MongoMatchRepository() }
): Promise<ImportClubMatchesResult> {
  return new ImportClubMatchesUseCase(dependencies).execute(input);
}

export function normalizeMatchForClub(
  clubId: number,
  summary: SokkerMatchSummaryDto,
  league: SokkerLeagueDto,
  playerStats: SokkerMatchPlayerStatsDto[]
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

function normalizeMatchPlayer(player: SokkerMatchPlayerStatsDto): MatchPlayerAppearance {
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
