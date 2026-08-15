import { formatDateTime } from "@atlas/web/app/formatters";
import type {
  MatchSummary,
  MatchesPageData,
  MatchesPageMatchType,
  WeeklyPlayerMinutes
} from "../pages/MatchesV2/types";

export interface MatchesPageViewModel {
  currentPeriodLabel: string | null;
  matchTypes: MatchesPageMatchType[];
  recentMatches: MatchSummaryViewModel[];
  weeklyPlayerMinutes: WeeklyPlayerMinutesViewModel[];
}

export interface MatchSummaryViewModel extends MatchSummary {
  dateLabel: string;
  matchTypeLabel: string;
}

export interface WeeklyPlayerMinutesViewModel extends WeeklyPlayerMinutes {
  minutesByMatchType: Partial<Record<MatchesPageMatchType, number>>;
  effectiveTrainingLabel: string;
  statusLabel: string;
}

const MATCH_TYPE_LABELS: Record<MatchesPageMatchType, string> = {
  OFFICIAL: "Official",
  FRIENDLY: "Friendly",
  NOT_ELIGIBLE: "Not eligible"
};

export function createMatchesPageViewModel(data: MatchesPageData): MatchesPageViewModel {
  return {
    currentPeriodLabel:
      data.currentPeriod.week === null ? null : `Training week ${data.currentPeriod.week}`,
    matchTypes: data.matchTypes,
    recentMatches: data.recentMatches.map((match) => ({
      ...match,
      dateLabel: formatDateTime(match.playedAt),
      matchTypeLabel: MATCH_TYPE_LABELS[match.matchType]
    })),
    weeklyPlayerMinutes: data.weeklyPlayerMinutes.map((player) => ({
      ...player,
      effectiveTrainingLabel:
        player.effectiveTraining === null ? "—" : `${player.effectiveTraining}%`,
      statusLabel: player.status ?? "—"
    }))
  };
}

export function matchTypeLabel(matchType: MatchesPageMatchType): string {
  return MATCH_TYPE_LABELS[matchType];
}
