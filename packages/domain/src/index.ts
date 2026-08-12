export type DataTraceKind = "observed" | "derived" | "assumed" | "recommended";

export type AvailabilityStatus = "available" | "injured" | "suspended" | "unknown";

export type PlayerRole =
  | "goalkeeper" | "defender" | "midfielder" | "winger" | "striker" | "trainee" | "undefined";

export type ObservedPosition = Exclude<PlayerRole, "trainee" | "undefined">;

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
  playerId: number;
  snapshotId: string;
  age: number;
  wage: Money;
  value: Money;
  form?: number | null;
  availabilityStatus?: AvailabilityStatus;
  observedPosition?: ObservedPosition | null;
  skills: SkillSet;

}

export type YouthPlayerStatus = "in_academy" | "ready_for_promotion" | "promoted";

export interface YouthPlayerSnapshot {
  id: string;
  externalId?: string | null;
  name: string;
  age: number;
  weeksInAcademy?: number | null;
  weeksRemaining?: number | null;
  level: number;
  status: YouthPlayerStatus;
}

export interface YouthAcademySnapshot {
  id: string;
  clubId: string;
  snapshotDate: string;
  importedAt: string;
  source: string;
  sourceVersion?: string | null;
  gameWeek?: number | null;
  week?: number | null;
  weeklyInvestment?: Money | null;
  players: YouthPlayerSnapshot[];
}

export interface Assumption {
  code: string;
  description: string;
  traceKind: "assumed";
}

export interface Finding {
  code: string;
  title: string;
  severity: Severity;
  evidence: string[];
  assumptions: Assumption[];
}

export type Severity = "info" | "low" | "medium" | "high";

export interface Diagnostic {
  id: string;
  snapshotId: string;
  generatedAt: string;
  findings: Finding[];
}

export * from "./diagnostics.js";
export * from "./historicalFindings.js";
export * from "./historicalTrends.js";
export * from "./snapshotComparison.js";
