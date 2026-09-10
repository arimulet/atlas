import type { SkillKey } from "../types.js";
import type {
  SnapshotComparisonPlayer,
  SnapshotComparisonSnapshot
} from "../snapshotComparison.js";

export type TrendDirection = "up" | "down" | "stable" | "insufficient_data";

export interface TrendSnapshotEvidence {
  snapshotId: string;
  snapshotDate: string;
  value: number | null;
}

export interface TrendEvidence {
  initialSnapshot: TrendSnapshotEvidence | null;
  finalSnapshot: TrendSnapshotEvidence | null;
  deltaAbsolute: number | null;
  deltaPercentage: number | null;
  dataPoints: number;
  warnings: string[];
}

export interface NumericTrend {
  direction: TrendDirection;
  evidence: TrendEvidence;
}

export interface MoneyTrend extends NumericTrend {
  currency: string | null;
  isComparable: boolean;
}

export interface SkillTrend extends NumericTrend {
  skill: SkillKey;
}

export interface PlayerHistoricalTrend {
  identity: {
    playerId: number;
  };
  playerName: string;
  value: MoneyTrend;
  wage: MoneyTrend;
  skills: SkillTrend[];
  warnings: string[];
}

export interface SquadHistoricalTrendSummary {
  valueTotal: MoneyTrend;
  wageTotal: MoneyTrend;
  playerCount: NumericTrend;
  mainVariations: Array<{
    playerId: number;
    playerName: string;
    metric: "value" | "wage";
    deltaAbsolute: number;
    deltaPercentage: number | null;
    direction: Exclude<TrendDirection, "insufficient_data" | "stable">;
  }>;
  warnings: string[];
}

export interface HistoricalTrends {
  clubId: string;
  snapshotIds: string[];
  snapshotDates: string[];
  players: PlayerHistoricalTrend[];
  squad: SquadHistoricalTrendSummary;
  warnings: string[];
}

export type HistoricalTrendPoint = {
  snapshot: SnapshotComparisonSnapshot;
  player: SnapshotComparisonPlayer;
};
