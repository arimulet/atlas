export interface PersistedImportIssue {
  path: string;
  message: string;
}

export interface PersistedClub {
  id: string;
  clubId: number;
  country: number;
  training: { 
    GK: number | null;
    DEF: number | null;
    MID: number | null;
    ATT: number | null;
  } | null;
  name: string;
  gameWeek: number | null;
  week: number | null;
  lastSnapshotDate: Date | null;
  sourceType: string | null;
  observedAt: Date | null;
  settings: PersistedClubSettings;
}

export interface PersistedClubSettings {
  currency: { name: string; rate: number };
  week?: number | null;
  assumptions: PersistedClubSettingsRecord[];
  preferences: PersistedClubSettingsRecord[];
}

export interface PersistedClubSettingsRecord {
  key: string;
  value: string;
  updatedAt: Date;
}

export interface PersistedPlayer {
  id: string;
  playerId: number;
  clubId: number;
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
  playerId: number;
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
  gameWeek: number | null;
  week: number | null;
  importedAt: Date;
  source: SnapshotSource;
  sourceVersion: string | null;
  players: PersistedPlayerSnapshot[];
}

export interface PersistedYouthPlayerSnapshot {
  id: string;
  playerId: number;
  name: string;
  age: number;
  initialWeeksRemaining: number | null;
  weeksRemaining: number | null;
  estimatedLevel: string | null;
  status: "in_academy" | "ready_for_promotion" | "promoted";
}

export interface PersistedYouthSnapshot {
  id: string;
  clubId: string;
  schemaVersion: string;
  snapshotDate: Date;
  gameWeek: number | null;
  week: number | null;
  importedAt: Date;
  source: SnapshotSource;
  sourceVersion: string | null;
  weeklyInvestment: SnapshotMoney | null;
  players: PersistedYouthPlayerSnapshot[];
}

export type PersistedYouthAcademySnapshot = PersistedYouthSnapshot;

export interface PersistedCountry {
  id: string;
  countryId: number;
  name: string;
  currencyName: string;
  currencyRate: number;
}

export interface SaveCountryInput {
  countryId: number;
  name: string;
  currencyName: string;
  currencyRate: number;
}
