import { type ImportIssue, type PlayerSnapshotV0 } from "@atlas/contracts";
import type { BasicDiagnostic } from "@atlas/domain";
import { ClubId, Money, SkillKey } from "../types.js";

export type ImportPlayerSnapshotStatus = "accepted" | "accepted-with-warnings" | "rejected";

export interface ImportPlayerSnapshotInput {
  payload: unknown;
}

export interface ImportPlayerSnapshotResult {
  status: ImportPlayerSnapshotStatus;
  errors: ImportIssue[];
  warnings: ImportIssue[];
  importEventId: string;
  snapshotId: string | null;
  clubId: ClubId | null;
  playerIds: string[];
  importedPlayerCount: number;
}

export interface ImportedSquadSummary {
  playerCount: number;
  snapshotDate: string;
  club: string;
  totalEstimatedValue: Money;
  totalWage: Money;
  incompletePlayerCount: number;
}

export interface ImportPlayerSnapshotMvpResult {
  importResult: ImportPlayerSnapshotResult;
  summary: ImportedSquadSummary | null;
  diagnostic: BasicDiagnostic | null;
}

export interface NormalizedPlayerSnapshot {
  schemaVersion: PlayerSnapshotV0["schemaVersion"];
  source: {
    type: PlayerSnapshotV0["source"]["type"];
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
    sourceType: PlayerSnapshotV0["source"]["type"];
    observedAt: Date;
  };
  snapshot: {
    snapshotDate: Date;
    season: number | null;
    week: number | null;
  };
  players: Array<{
    externalId: string | null;
    name: string;
    age: number;
    wage: { amount: number; currency: string | null };
    estimatedValue: { amount: number; currency: string | null };
    form: number | null;
    availabilityStatus: PlayerSnapshotV0["players"][number]["availabilityStatus"] | null;
    observedPosition: string | null;
    skills: Record<SkillKey, number | null>;
  }>;
}

export interface ValidatePlayerSnapshotInput {
  payload: unknown;
}

export interface GenerateBasicDiagnosticInput {
  snapshotId: string;
  generatedAt?: Date;
}
