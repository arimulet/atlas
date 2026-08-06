export type ImportStatus = "idle" | "loading" | "success" | "error";
export type DashboardStatus = "idle" | "loading" | "ready" | "error";
export type SourceKind = "observed" | "manual" | "effective";
export type SquadEconomyEvidenceKind = "observed" | "manual" | "derived" | "inferred";
export type SkillChangeDirection = "up" | "down" | "stable" | "insufficient_data";
export type PlayerDevelopmentFindingType =
  "improvement" | "stagnation" | "decline" | "insufficient_data";

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
  developmentSummary: ClubDashboardDevelopmentSummary;
  marketSummary: ClubDashboardMarketSummary;
  operationalAreas: OperationalArea[];
}

export interface ClubDashboardDevelopmentSummary {
  available: boolean;
  detailPath: string;
  observed: {
    snapshotCount: number;
    latestSnapshotDate: string | null;
    playerCount: number;
  };
  manual: {
    trainingPriority: string;
  };
  derived: {
    improvingPlayers: number;
    stagnatedPlayers: number;
    decliningPlayers: number;
    insufficientDataPlayers: number;
  };
  inferred: {
    headline: string;
    warning: string | null;
    highlightedPlayers: ClubDashboardDevelopmentPlayer[];
  };
}

export interface ClubDashboardDevelopmentPlayer {
  playerId: string | null;
  name: string;
  signal: PlayerDevelopmentFindingType;
  severity: "info" | "low" | "medium" | "high";
  confidence: "low" | "medium" | "high";
}

export interface ClubDashboardMarketSummary {
  available: boolean;
  detailPath: string;
  observed: {
    snapshotCount: number;
    latestSnapshotDate: string | null;
    playerCount: number;
    playersWithStableIdentity: number;
  };
  manual: {
    marketStrategy: string;
  };
  derived: {
    saleCandidates: number;
    protectionCandidates: number;
    followUpPlayers: number;
    insufficientSignalPlayers: number;
  };
  inferred: {
    headline: string;
    warning: string | null;
    highlightedPlayers: ClubDashboardMarketPlayer[];
  };
}

export interface ClubDashboardMarketPlayer {
  playerId: string | null;
  name: string;
  signal: SquadMarketCategory;
  severity: "info" | "low" | "medium" | "high";
  confidence: "low" | "medium" | "high";
  timing: string;
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

export type SquadMarketCategory =
  | "sale_candidate"
  | "protection_candidate"
  | "follow_up"
  | "insufficient_signal";

export interface SquadMarketPlanning {
  clubId: string;
  snapshotId: string | null;
  snapshotDate: string | null;
  observed: {
    players: SquadMarketObservedPlayer[];
    coverage: {
      playerCount: number;
      playersWithWage: number;
      playersWithEstimatedValue: number;
      playersWithStableIdentity: number;
    };
  };
  manual: {
    marketStrategy: string;
  };
  derived: {
    categoryCounts: Record<SquadMarketCategory, number>;
    players: SquadMarketPlayerPlan[];
  };
  warnings: SquadMarketWarning[];
}

export interface SquadMarketObservedPlayer {
  playerId: string | null;
  externalId: string | null;
  snapshotPlayerId: string;
  name: string;
  age: number;
  role: {
    label: string;
    source: "observed" | "inferred" | "unknown";
  };
  wage: { amount: number; currency: string | null };
  estimatedValue: { amount: number; currency: string | null };
}

export interface SquadMarketPlayerPlan {
  playerId: string | null;
  snapshotPlayerId: string;
  name: string;
  age: number;
  role: {
    label: string;
    source: "observed" | "inferred" | "unknown";
  };
  category: SquadMarketCategory;
  severity: "info" | "low" | "medium" | "high";
  confidence: "low" | "medium" | "high";
  rationale: string;
  timing: SquadMarketTiming;
  signals: SquadMarketSignal[];
  warnings: SquadMarketWarning[];
}

export interface SquadMarketTiming {
  label: string;
  window: {
    from: string | null;
    to: string | null;
    snapshotCount: number;
  };
  dataUsed: string[];
  mainReasons: string[];
  limits: string[];
}

export interface SquadMarketSignal {
  code: string;
  severity: "info" | "low" | "medium" | "high";
  confidence: "low" | "medium" | "high";
  message: string;
  evidence: SquadMarketEvidence[];
}

export interface SquadMarketWarning {
  code: string;
  message: string;
  evidence: SquadMarketEvidence[];
}

export interface SquadMarketEvidence {
  kind: SquadEconomyEvidenceKind;
  label: string;
  value: string | number | null;
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
    playerDetails: SquadEconomyPlayerDetail[];
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

export interface SquadEconomyPlayerDetail {
  playerId: string | null;
  snapshotPlayerId: string;
  name: string;
  age: number;
  wage: { amount: number; currency: string | null };
  estimatedValue: { amount: number; currency: string | null };
  wageShare: number | null;
  estimatedValueShare: number | null;
  wageToValueRatio: number | null;
  warnings: SquadEconomyWarning[];
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

export interface PlayerDevelopment {
  clubId: string;
  snapshotCount: number;
  snapshotDates: string[];
  observed: {
    latestSnapshotId: string | null;
    latestSnapshotDate: string | null;
    players: PlayerDevelopmentObservedPlayer[];
  };
  manual: {
    trainingPriority: string;
  };
  derived: {
    players: PlayerDevelopmentPlayerSummary[];
  };
  warnings: PlayerDevelopmentWarning[];
}

export interface PlayerDevelopmentObservedPlayer {
  playerId: string | null;
  externalId: string | null;
  snapshotPlayerId: string;
  name: string;
  age: number;
  observedPosition: string | null;
  roles: string[];
  skills: Record<string, number | null>;
}

export interface PlayerDevelopmentPlayerSummary {
  playerId: string | null;
  externalId: string | null;
  name: string;
  age: number;
  role: {
    label: string;
    source: "observed" | "inferred" | "unknown";
  };
  relevantSkills: Array<{
    skill: string;
    value: number | null;
  }>;
  skillChanges: PlayerSkillChange[];
  recentEvolution: {
    direction: SkillChangeDirection;
    improvedSkills: number;
    declinedSkills: number;
    stableSkills: number;
    comparableSkills: number;
    confidence: "low" | "medium" | "high";
  };
  findings: PlayerDevelopmentFinding[];
  signals: PlayerDevelopmentSignal[];
  warnings: PlayerDevelopmentWarning[];
}

export interface PlayerSkillChange {
  skill: string;
  direction: SkillChangeDirection;
  previousValue: number | null;
  currentValue: number | null;
  delta: number | null;
}

export interface PlayerDevelopmentSignal {
  code: string;
  confidence: "low" | "medium" | "high";
  message: string;
  evidence: PlayerDevelopmentEvidence[];
}

export interface PlayerDevelopmentFinding {
  type: PlayerDevelopmentFindingType;
  severity: "info" | "low" | "medium" | "high";
  confidence: "low" | "medium" | "high";
  title: string;
  description: string;
  evidence: PlayerDevelopmentEvidence[];
}

export interface PlayerDevelopmentWarning {
  code: string;
  message: string;
  evidence: PlayerDevelopmentEvidence[];
}

export interface PlayerDevelopmentEvidence {
  kind: SquadEconomyEvidenceKind;
  label: string;
  value: string | number | null;
}
