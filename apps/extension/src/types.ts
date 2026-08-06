export const PLAYER_SNAPSHOT_SCHEMA_VERSION = "atlas.player-snapshot.v0" as const;

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

export interface ExtractionWarning {
  path: string;
  message: string;
}

export interface ExtractionResult {
  snapshot: PlayerSnapshotExport;
  warnings: ExtractionWarning[];
}
