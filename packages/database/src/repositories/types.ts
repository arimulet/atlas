export type PersistedDevelopmentProfile =
  "goalkeeper" | "defender" | "wing_defender" | "midfielder" | "winger" | "forward";

export type PersistedDevelopmentSkill =
  "stamina" | "pace" | "technique" | "passing" | "keeper" | "defender" | "playmaker" | "striker";

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

export interface PersistedClubStaffMember {
  trainerId: number;
  name: string;
  assignment: "HEAD" | "ASSISTANT" | "YOUTH";
  contracted: boolean;
  salary: number;
  age: number;
  skills: Record<string, { level: number; effectivenessPercent: number }>;
  averageEffectivenessPercent: number;
  status: string;
  active: boolean;
}

export interface PersistedClub {
  id: string;
  clubId: number;
  country: number;
  currency: string;
  training: {
    GK: number;
    DEF: number;
    MID: number;
    ATT: number;
  };
  name: string;
  budget: number | null;
  staff: PersistedClubStaffMember[];
  gameWeek: number | null;
  week: number | null;
  lastSnapshotDate: Date | null;
  observedAt: Date | null;
  settings: PersistedClubSettings;
}

export interface PersistedClubSettings {
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
  countryId: number | null;
  countryName?: string | null;
  age: number | null;
  position: string | null;
  skills: Record<string, number> | null;
  marketValue: number | null;
  wage: number | null;
  cards: { yellow: number; red: number };
  injury: { days: number | null; severe: boolean | null };
  currentGameWeek: number | null;
}

export interface PersistedJunior {
  id: string;
  juniorId: number;
  clubId: number;
  name: string;
  initialAge: number;
  age: number;
  initialLevel: number;
  currentLevel: number;
  initialWeeks: number;
  weeksLeft: number;
  status: "in_academy" | "promoted" | "rejected";
}

export type PersistedPlayerTransferSource = string;
export type PersistedTransferDataQuality = "complete" | "partial" | "weak";
export type PersistedSalePriceType = "final_sale" | "unknown";
export type PersistedTransferFormation = "GK" | "DEF" | "MID" | "ATT";
export type PersistedTransferProfile =
  "goalkeeper" | "defender" | "wing_defender" | "midfielder" | "winger" | "forward";
export type PersistedTransferSkills = Partial<
  Record<
    "stamina" | "pace" | "technique" | "passing" | "keeper" | "defender" | "playmaker" | "striker",
    number | null
  >
>;

export interface PersistedPlayerTransfer {
  id: string;
  transferKey: string;
  transferId?: string;
  playerId?: number;
  transferDate: Date;
  gameWeek?: number | null;
  salePrice: number;
  currency?: string | null;
  normalizedSalePrice?: number | null;
  age: number;
  skills: PersistedTransferSkills;
  formation?: PersistedTransferFormation | null;
  developmentProfile?: PersistedTransferProfile | null;
  sokkerValue?: number | null;
  source: PersistedPlayerTransferSource;
  dataQuality?: PersistedTransferDataQuality;
  salePriceType?: PersistedSalePriceType;
}

export type SavePlayerTransferInput = Omit<PersistedPlayerTransfer, "id" | "transferKey">;

export interface PersistedPlayerDevelopmentOverride {
  id: string;
  playerId: number;
  clubId: number;
  profile: PersistedDevelopmentProfile | null;
  targetLevels: Partial<Record<PersistedDevelopmentSkill, number>>;
  targetAge: number | null;
}

export type PersistedSquadRole =
  "core" | "developing" | "prospect" | "rotation" | "depth" | "transition";

export interface PersistedSquadRoleAssignment {
  id: string;
  playerId: number;
  clubId: number;
  role: PersistedSquadRole;
  source: "manual";
}

export interface SaveSquadRoleAssignmentInput {
  playerId: number;
  clubId: number;
  role: PersistedSquadRole;
}

export interface SavePlayerDevelopmentOverrideInput {
  playerId: number;
  clubId: number;
  profile?: PersistedDevelopmentProfile | null;
  targetLevels?: Partial<Record<PersistedDevelopmentSkill, number>>;
  targetAge?: number | null;
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
  countryName?: string | null;
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
  initialLevel: number | null;
  weeksRemaining: number | null;
  skill: number | null;
  status: "in_academy" | "ready_for_promotion" | "promoted";
}

export interface PersistedSnapshot {
  id: string;
  clubId: number;
  schemaVersion: string;
  snapshotDate: Date;
  gameWeek: number | null;
  week: number | null;
  importedAt: Date;
  players: PersistedPlayerSnapshot[];
  juniors: PersistedJuniorSnapshot[];
}

export interface PersistedYouthPlayerSnapshot {
  id: string;
  playerId: number;
  name: string;
  age: number;
  initialLevel: number | null;
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

export type SavePlayerTrainingWeekInput = Omit<
  PersistedPlayerTrainingWeek,
  "id" | "skills" | "skillChanges"
>;

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
