export type ObservedPosition = "goalkeeper" | "defender" | "midfielder" | "winger" | "striker";

export type PersistedTrainingSkill =
  "stamina" | "keeper" | "playmaking" | "passing" | "technique" | "defending" | "striker" | "pace";

export interface PersistedTrainingSkillChange {
  skill: PersistedTrainingSkill;
  before: number;
  after: number;
  delta: number;
  direction: "up" | "down";
}

export type PersistedPlayerSkills = Partial<Record<PersistedTrainingSkill, number>>;

export interface PersistedPlayerSkillsChange extends PersistedPlayerSkills {
  up: number;
  down: number;
}

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
  wage: number;
  value: number;
  training: {
    position: number;
    advanced: boolean;
  };
  form: number | null;
  availabilityStatus: "available" | "injured" | "suspended" | "unknown" | null;
  observedPosition: ObservedPosition | null;
  skills: SnapshotSkillSet;
}

export interface PersistedJuniorSnapshot {
  id: string;
  playerId: number;
  name: string;
  age: number;
  initialWeeksRemaining: number | null;
  weeksRemaining: number | null;
  skill: number | null;
  status: "in_academy" | "ready_for_promotion" | "promoted";
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
  juniors: PersistedJuniorSnapshot[];
}

export interface PersistedYouthPlayerSnapshot {
  id: string;
  playerId: number;
  name: string;
  age: number;
  initialWeeksRemaining: number | null;
  weeksRemaining: number | null;
  skill: number | null;
  status: "in_academy" | "ready_for_promotion" | "promoted";
}

export interface PersistedPlayerTrainingWeek {
  id: string;
  clubId: number;
  playerId: number;
  gameWeek: number;
  season: number | null;
  seasonWeek: number;
  date: Date;
  type:
    | "general"
    | "stamina"
    | "keeper"
    | "playmaking"
    | "passing"
    | "technique"
    | "defending"
    | "striker"
    | "pace";
  kind: "advanced" | "formation" | "missing";
  intensity: number;
  age: number;
  skills: PersistedPlayerSkills;
  skillsChange: PersistedPlayerSkillsChange;
  skillChanges: PersistedTrainingSkillChange[];
}

export type SavePlayerTrainingWeekInput = Omit<PersistedPlayerTrainingWeek, "id">;

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
