import { calculateTrainingEfficiency } from "@atlas/domain";
import {
  MongoClubRepository,
  MongoMatchRepository,
  MongoSnapshotRepository,
  type PersistedMatch,
  type PersistedPlayerSnapshot
} from "@atlas/database";
import type { ClubId } from "../types.js";

export type MatchesPageMatchType = PersistedMatch["matchType"];

export interface MatchesPageData {
  currentPeriod: {
    week: number | null;
    snapshotDate: string | null;
  };
  matchTypes: MatchesPageMatchType[];
  recentMatches: MatchSummary[];
  weeklyPlayerMinutes: WeeklyPlayerMinutes[];
}

export interface MatchSummary {
  id: number;
  playedAt: string;
  matchType: MatchesPageMatchType;
  side: PersistedMatch["side"];
  opponent: PersistedMatch["opponent"];
  score: PersistedMatch["score"];
}

export interface WeeklyPlayerMinutes {
  playerId: number;
  playerName: string;
  minutesByMatchType: Partial<Record<MatchesPageMatchType, number>>;
  totalMinutes: number;
  effectiveTraining: number | null;
  status: null;
}

const MATCH_TYPE_ORDER: MatchesPageMatchType[] = ["OFFICIAL", "FRIENDLY", "NOT_ELIGIBLE"];
const RECENT_MATCH_LIMIT = 8;

const clubRepository = new MongoClubRepository();
const matchRepository = new MongoMatchRepository();
const snapshotRepository = new MongoSnapshotRepository();

export async function getClubMatchesPageData(clubId: ClubId): Promise<MatchesPageData> {
  const club = await clubRepository.findById(clubId.toString());

  if (!club) {
    throw new Error(`Club not found: ${clubId}`);
  }

  const [matches, snapshots] = await Promise.all([
    matchRepository.listByClub(club.clubId),
    snapshotRepository.listByClub(clubId)
  ]);
  const latestSnapshot = snapshots.at(-1) ?? null;
  const currentWeek = latestSnapshot?.week ?? club.week ?? null;
  const currentMatches =
    currentWeek === null ? [] : matches.filter((match) => match.week === currentWeek);

  return {
    currentPeriod: {
      week: currentWeek,
      snapshotDate: latestSnapshot?.snapshotDate.toISOString().slice(0, 10) ?? null
    },
    matchTypes: matchTypesFor(currentMatches),
    recentMatches: matches
      .slice()
      .sort((first, second) => second.playedAt.getTime() - first.playedAt.getTime())
      .slice(0, RECENT_MATCH_LIMIT)
      .map(toMatchSummary),
    weeklyPlayerMinutes: buildWeeklyPlayerMinutes(latestSnapshot?.players ?? [], currentMatches)
  };
}

function buildWeeklyPlayerMinutes(
  players: PersistedPlayerSnapshot[],
  matches: PersistedMatch[]
): WeeklyPlayerMinutes[] {
  const minutesByPlayer = new Map<number, Partial<Record<MatchesPageMatchType, number>>>();

  for (const match of matches) {
    for (const appearance of match.players) {
      const playerMinutes = minutesByPlayer.get(appearance.playerId) ?? {};
      playerMinutes[match.matchType] =
        (playerMinutes[match.matchType] ?? 0) + appearance.minutesPlayed;
      minutesByPlayer.set(appearance.playerId, playerMinutes);
    }
  }

  return players.map((player) => {
    const minutesByMatchType = minutesByPlayer.get(player.playerId) ?? {};
    const officialMinutes = minutesByMatchType.OFFICIAL ?? 0;
    const friendlyMinutes = minutesByMatchType.FRIENDLY ?? 0;
    const totalMinutes = Object.values(minutesByMatchType).reduce(
      (total, minutes) => total + (minutes ?? 0),
      0
    );
    const effectiveTraining = calculateTrainingEfficiency({
      officialMinutes,
      friendlyMinutes,
      advancedTraining: player.training.advanced
    }).trainingEfficiency;

    return {
      playerId: player.playerId,
      playerName: player.name,
      minutesByMatchType,
      totalMinutes,
      effectiveTraining,
      status: null
    };
  });
}

function matchTypesFor(matches: PersistedMatch[]): MatchesPageMatchType[] {
  const availableTypes = new Set(matches.map((match) => match.matchType));
  return MATCH_TYPE_ORDER.filter((matchType) => availableTypes.has(matchType));
}

function toMatchSummary(match: PersistedMatch): MatchSummary {
  return {
    id: match.id,
    playedAt: match.playedAt.toISOString(),
    matchType: match.matchType,
    side: match.side,
    opponent: match.opponent,
    score: match.score
  };
}
