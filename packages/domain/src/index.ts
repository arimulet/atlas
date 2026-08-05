export type DataTraceKind = "observed" | "derived" | "assumed" | "recommended";

export type AvailabilityStatus = "available" | "injured" | "suspended" | "unknown";

export type PlayerRole =
  | "goalkeeper"
  | "defender"
  | "midfielder"
  | "winger"
  | "striker"
  | "trainee"
  | "undefined";

export interface Money {
  amount: number;
  currency: string | null;
}

export interface SkillSet {
  stamina?: number | null;
  pace?: number | null;
  technique?: number | null;
  passing?: number | null;
  keeper?: number | null;
  defender?: number | null;
  playmaker?: number | null;
  striker?: number | null;
}

export interface Club {
  id: string;
  externalId?: string | null;
  name: string;
}

export interface Snapshot {
  id: string;
  clubId: string;
  snapshotDate: string;
  importedAt: string;
  source: string;
  sourceVersion?: string | null;
}

export interface Player {
  id: string;
  externalId?: string | null;
  name: string;
}

export interface PlayerSnapshot {
  id: string;
  playerId: string;
  snapshotId: string;
  age: number;
  wage: Money;
  estimatedValue: Money;
  form?: number | null;
  availabilityStatus?: AvailabilityStatus;
  observedPosition?: string | null;
  skills: SkillSet;
  roles: PlayerRole[];
}

export interface Assumption {
  code: string;
  description: string;
  traceKind: "assumed";
}

export interface Finding {
  code: string;
  title: string;
  severity: "info" | "low" | "medium" | "high";
  evidence: string[];
  assumptions: Assumption[];
}

export interface Diagnostic {
  id: string;
  snapshotId: string;
  generatedAt: string;
  findings: Finding[];
}
