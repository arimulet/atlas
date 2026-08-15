import type { DashboardStatus } from "@atlas/web/app/types";

export type MatchesPageMatchType = "OFFICIAL" | "FRIENDLY" | "NOT_ELIGIBLE";

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
  side: "HOME" | "AWAY";
  opponent: {
    id: number;
    name: string;
  };
  score: {
    club: number;
    opponent: number;
  };
}

export interface WeeklyPlayerMinutes {
  playerId: number;
  playerName: string;
  minutesByMatchType: Partial<Record<MatchesPageMatchType, number>>;
  totalMinutes: number;
  effectiveTraining: number | null;
  status: null;
}

export interface MatchesV2Props {
  data: MatchesPageData | null;
  onSelectPlayer: (playerId: string) => void;
  status: DashboardStatus;
}
