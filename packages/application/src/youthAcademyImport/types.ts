import type { ImportIssue } from "@atlas/contracts";

export interface ImportYouthAcademySnapshotInput {
  payload: unknown;
}

export interface ValidateYouthAcademySnapshotInput {
  payload: unknown;
}

export interface ImportYouthAcademySnapshotResult {
  status: "accepted" | "accepted-with-warnings" | "rejected";
  errors: ImportIssue[];
  warnings: ImportIssue[];
  importEventId: string;
  snapshotId: string | null;
  clubId: string | null;
  importedPlayerCount: number;
}

export interface NormalizedYouthAcademySnapshot {
  schemaVersion: string;
  source: {
    type: string;
    exportedAt: Date;
    pageUrl: string | null;
    locale: string | null;
  };
  club: {
    clubId: number;
    country: number;
    training?: {
      GK: number | null;
      DEF: number | null;
      MID: number | null;
      ATT: number | null;
    } | null;
    name: string;
    season: number | null;
    week: number | null;
    lastSnapshotDate: Date;
    sourceType: string;
    observedAt: Date;
  };
  snapshot: {
    snapshotDate: Date;
    season: number | null;
    week: number | null;
  };
  academy: {
    weeklyInvestment: {
      amount: number;
      currency: string | null;
    } | null;
    players: Array<{
      externalId: string | null;
      name: string;
      age: number;
      initialWeeksRemaining: number | null;
      weeksInAcademy: number | null;
      weeksRemaining: number | null;
      estimatedLevel: string | null;
      status: "in_academy" | "ready_for_promotion" | "promoted";
    }>;
  };
}
