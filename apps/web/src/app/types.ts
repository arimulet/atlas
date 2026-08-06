export type ImportStatus = "idle" | "loading" | "success" | "error";
export type DashboardStatus = "idle" | "loading" | "ready" | "error";
export type SourceKind = "observed" | "manual" | "effective";
export type SquadEconomyEvidenceKind = "observed" | "manual" | "derived" | "inferred";

export interface ImportIssue {
  path: string;
  message: string;
}

export interface MoneyTotal {
  amount: number;
  currency: string | null;
  isComplete: boolean;
}

export interface SquadSummary {
  playerCount: number;
  snapshotDate: string;
  club: string;
  totalEstimatedValue: MoneyTotal;
  totalWage: MoneyTotal;
  incompletePlayerCount: number;
}

export interface DiagnosticTrace {
  kind: "observed" | "derived" | "assumed" | "recommended";
  label: string;
  value: string | number | null;
}

export interface DiagnosticAssumption {
  code: string;
  description: string;
  traceKind: "assumed";
}

export interface DiagnosticFinding {
  code: string;
  category: string;
  severity: "info" | "low" | "medium" | "high";
  description: string;
  evidence: DiagnosticTrace[];
  assumptions: DiagnosticAssumption[];
  confidence: "low" | "medium" | "high";
  affectedPlayerIds: string[];
}

export interface ImportResponse {
  importResult: {
    status: "accepted" | "accepted-with-warnings" | "rejected";
    errors: ImportIssue[];
    warnings: ImportIssue[];
    clubId: string | null;
    importedPlayerCount: number;
  };
  summary: SquadSummary | null;
  diagnostic: {
    findings: DiagnosticFinding[];
  } | null;
}

export interface ManualRecord {
  key: string;
  value: string;
  updatedAt: string;
}

export type OperatingPreferenceKey =
  "economy.riskTolerance" | "training.priority" | "academy.investment" | "market.strategy";

export interface ClubDashboard {
  club: {
    id: string;
    observed: {
      externalId: string | null;
      name: string;
      season: number | null;
      week: number | null;
      lastSnapshotDate: string | null;
      sourceType: string | null;
      observedAt: string | null;
    };
    manual: {
      name: string | null;
      currency: string | null;
      season: number | null;
      week: number | null;
      assumptions: ManualRecord[];
      preferences: ManualRecord[];
    };
    profile: {
      externalId: string | null;
      name: string;
      currency: string | null;
      season: number | null;
      week: number | null;
    };
  };
  settings: {
    observed: {
      season: number | null;
      week: number | null;
    };
    manual: {
      currency: string | null;
      season: number | null;
      week: number | null;
      preferences: Partial<Record<OperatingPreferenceKey, string>>;
    };
    effective: {
      currency: string | null;
      season: number | null;
      week: number | null;
      preferences: Record<OperatingPreferenceKey, string>;
    };
  };
  snapshots: {
    available: boolean;
    count: number;
    latest: SnapshotSummary | null;
    previous: SnapshotSummary | null;
    canCompare: boolean;
  };
  operationalAreas: OperationalArea[];
}

export interface SnapshotSummary {
  id: string;
  snapshotDate: string;
  importedAt: string;
  season: number | null;
  week: number | null;
  playerCount: number;
}

export interface OperationalArea {
  key: string;
  label: string;
  status: "available" | "ready" | "planned";
  summary: string;
}

export interface SquadEconomy {
  clubId: string;
  snapshotId: string | null;
  snapshotDate: string | null;
  observed: {
    players: SquadEconomyObservedPlayer[];
    coverage: {
      playerCount: number;
      playersWithWage: number;
      playersWithEstimatedValue: number;
      wageCurrency: string | null;
      estimatedValueCurrency: string | null;
    };
  };
  manual: {
    currency: string | null;
    riskTolerance: string;
  };
  derived: {
    totalWage: MoneyTotal;
    totalEstimatedValue: MoneyTotal;
    wageToValueRatio: number | null;
    concentration: {
      wage: SquadEconomyConcentration[];
      estimatedValue: SquadEconomyConcentration[];
    };
  };
  historical: {
    comparableSnapshotCount: number;
    previousSnapshot: SquadEconomyHistoricalSnapshot | null;
    currentSnapshot: SquadEconomyHistoricalSnapshot | null;
    changes: {
      totalWageDelta: number | null;
      totalWageDeltaPercent: number | null;
      totalEstimatedValueDelta: number | null;
      totalEstimatedValueDeltaPercent: number | null;
      wageToValueRatioDelta: number | null;
    };
  };
  findings: SquadEconomyFinding[];
  warnings: SquadEconomyWarning[];
}

export interface SquadEconomyObservedPlayer {
  playerId: string | null;
  snapshotPlayerId: string;
  name: string;
  age: number;
  wage: { amount: number; currency: string | null };
  estimatedValue: { amount: number; currency: string | null };
}

export interface SquadEconomyConcentration {
  playerId: string | null;
  snapshotPlayerId: string;
  name: string;
  amount: number;
  currency: string | null;
  share: number | null;
}

export interface SquadEconomyHistoricalSnapshot {
  snapshotId: string;
  snapshotDate: string;
  totalWage: MoneyTotal;
  totalEstimatedValue: MoneyTotal;
  wageToValueRatio: number | null;
}

export interface SquadEconomyFinding {
  code: string;
  severity: "info" | "low" | "medium" | "high";
  confidence: "low" | "medium" | "high";
  title: string;
  description: string;
  evidence: SquadEconomyEvidence[];
}

export interface SquadEconomyWarning {
  code: string;
  message: string;
  evidence: SquadEconomyEvidence[];
}

export interface SquadEconomyEvidence {
  kind: SquadEconomyEvidenceKind;
  label: string;
  value: string | number | null;
}
