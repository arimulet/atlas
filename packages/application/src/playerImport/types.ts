import { type ImportIssue, type PlayerSnapshotV0 } from "@atlas/contracts";
import type { BasicDiagnostic, ObservedPosition } from "@atlas/domain";
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
  currency: { name: string; rate: number };
  totalValue: Money;
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
    gameWeek?: number | null;
    week: number | null;
    lastSnapshotDate: Date;
    observedAt: Date;
  };
  snapshot: {
    snapshotDate: Date;
    gameWeek: number | null;
    week: number | null;
  };
  players: Array<{
    playerId: number;
    name: string;
    age: number;
    wage: number;
    value: number;
    training: { position: number; advanced: boolean };
    form: number | null;
    availabilityStatus: PlayerSnapshotV0["players"][number]["availabilityStatus"] | null;
    observedPosition: ObservedPosition | null;
    skills: Record<SkillKey, number | null>;
  }>;
  juniors: Array<{
    playerId: number;
    name: string;
    age: number;
    initialLevel: number | null;
    initialWeeksRemaining: number | null;
    weeksRemaining: number | null;
    skill: number;
    status: "in_academy" | "ready_for_promotion" | "promoted";
  }>;
}

export interface ValidatePlayerSnapshotInput {
  payload: unknown;
}

export interface GenerateBasicDiagnosticInput {
  snapshotId: string;
  generatedAt?: Date;
}
