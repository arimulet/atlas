export interface PersistedImportIssue {
  path: string;
  message: string;
}

export interface PersistedClub {
  id: string;
  externalId: string | null;
  name: string;
}

export interface PersistedPlayer {
  id: string;
  externalId: string | null;
  name: string;
}

export interface PersistedImportEvent {
  id: string;
  schemaVersion: string | null;
  sourceType: string | null;
  status: "accepted" | "accepted-with-warnings" | "rejected";
  errors: PersistedImportIssue[];
  warnings: PersistedImportIssue[];
  clubId: string | null;
  snapshotId: string | null;
  importedAt: Date;
}

export interface SnapshotMoney {
  amount: number;
  currency: string | null;
}

export interface SnapshotSkillSet {
  stamina: number | null;
  pace: number | null;
  technique: number | null;
  passing: number | null;
  keeper: number | null;
  defender: number | null;
  playmaker: number | null;
  striker: number | null;
}

export interface PersistedPlayerSnapshot {
  id: string;
  playerId: string | null;
  externalId: string | null;
  name: string;
  age: number;
  wage: SnapshotMoney;
  estimatedValue: SnapshotMoney;
  form: number | null;
  availabilityStatus: "available" | "injured" | "suspended" | "unknown" | null;
  observedPosition: string | null;
  skills: SnapshotSkillSet;
  roles: string[];
}

export interface SnapshotSource {
  type: string;
  exportedAt: Date;
  pageUrl: string | null;
  locale: string | null;
}

export interface PersistedSnapshot {
  id: string;
  clubId: string;
  schemaVersion: string;
  snapshotDate: Date;
  season: number | null;
  week: number | null;
  importedAt: Date;
  source: SnapshotSource;
  sourceVersion: string | null;
  players: PersistedPlayerSnapshot[];
}
