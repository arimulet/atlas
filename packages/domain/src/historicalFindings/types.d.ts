import type { Confidence, EvidenceKind, Severity, SkillSet } from "../types.js";

export type HistoricalFindingType =
  | "player_sustained_asset_appreciation"
  | "player_asset_or_sporting_deterioration"
  | "player_stagnation"
  | "risky_wage_against_historical_evolution"
  | "squad_asset_evolution";

export interface HistoricalFindingEvidence {
  kind: EvidenceKind;
  metric: string;
  description: string;
  value?: number | string | null;
}

export interface HistoricalFinding {
  type: HistoricalFindingType;
  severity: Severity;
  confidence: Confidence;
  subject:
    | {
        kind: "player";
        playerId: number;
        playerName: string;
      }
    | {
        kind: "squad";
        clubId: string;
      };
  evidence: HistoricalFindingEvidence[];
  period: {
    fromSnapshotId: string;
    toSnapshotId: string;
    fromDate: string;
    toDate: string;
    dataPoints: number;
  };
  actionSuggested: string;
}

export interface HistoricalFindings {
  clubId: string;
  snapshotIds: string[];
  snapshotDates: string[];
  taxonomy: HistoricalFindingType[];
  findings: HistoricalFinding[];
  warnings: string[];
}

export interface PlayerSeriesPoint {
  value: number;
  skills: Required<SkillSet>;
}

export type HistoricalFindingPeriod = HistoricalFinding["period"];
