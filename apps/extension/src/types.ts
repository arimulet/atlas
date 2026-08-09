export const PLAYER_SNAPSHOT_SCHEMA_VERSION = "atlas.player-snapshot.v0" as const;
export const YOUTH_ACADEMY_SNAPSHOT_SCHEMA_VERSION = "atlas.youth-academy-snapshot.v0" as const;

export type SkillKey =
  | "stamina"
  | "pace"
  | "technique"
  | "passing"
  | "keeper"
  | "defender"
  | "playmaker"
  | "striker";

export interface Money {
  amount: number;
  currency: string | null;
}

export interface PlayerExport {
  externalId: string | null;
  name: string;
  age: number;
  wage: Money;
  estimatedValue: Money;
  form: number | null;
  availabilityStatus: "available" | "injured" | "suspended" | "unknown";
  observedPosition: string | null;
  skills: Record<SkillKey, number | null>;
}

export interface PlayerSnapshotExport {
  schemaVersion: typeof PLAYER_SNAPSHOT_SCHEMA_VERSION;
  source: {
    type: "sokker-dom-export";
    exportedAt: string;
    pageUrl: string | null;
    locale: string | null;
  };
  club: {
    externalId: string | null;
    name: string;
  };
  snapshot: {
    snapshotDate: string;
    season: number | null;
    week: number | null;
  };
  players: PlayerExport[];
}

export interface YouthPlayerExport {
  externalId: string | null;
  name: string;
  age: number;
  weeksInAcademy: number | null;
  weeksRemaining: number | null;
  estimatedLevel: string | null;
  status: "in_academy" | "ready_for_promotion" | "promoted" | null;
}

export interface YouthAcademySnapshotExport {
  schemaVersion: typeof YOUTH_ACADEMY_SNAPSHOT_SCHEMA_VERSION;
  source: {
    type: "sokker-dom-export";
    exportedAt: string;
    pageUrl: string | null;
    locale: string | null;
  };
  club: {
    externalId: string | null;
    name: string;
  };
  snapshot: {
    snapshotDate: string;
    season: number | null;
    week: number | null;
  };
  academy: {
    weeklyInvestment: Money | null;
    players: YouthPlayerExport[];
  };
}

export interface ExtractionWarning {
  path: string;
  message: string;
}

export interface ExtractionResult<T = PlayerSnapshotExport | YouthAcademySnapshotExport> {
  snapshot: T;
  warnings: ExtractionWarning[];
}
