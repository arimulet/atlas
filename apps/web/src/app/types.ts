export type ImportStatus = "idle" | "loading" | "success" | "error";
export type DashboardStatus = "idle" | "loading" | "ready" | "error";
export type SourceKind = "observed" | "manual" | "effective";
export type SquadEconomyEvidenceKind = "observed" | "manual" | "derived" | "inferred";
export type SkillChangeDirection = "up" | "down" | "stable" | "insufficient_data";
export type PlayerDevelopmentFindingType =
  "improvement" | "stagnation" | "decline" | "insufficient_data";
export type YouthPipelineCategory =
  "standout_prospect" | "follow_up" | "stagnation_risk" | "insufficient_data";

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
  severity: Severity;
  description: string;
  evidence: DiagnosticTrace[];
  assumptions: DiagnosticAssumption[];
  confidence: "low" | "medium" | "high";
  affectedPlayerIds: string[];
}

export type Severity =  "info" | "low" | "medium" | "high";

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
    externalId: string | null;
    name: string;
    season: number | null;
    week: number | null;
    lastSnapshotDate: string | null;
    sourceType: string | null;
    observedAt: string | null;
    settings: {
      currency: string | null;
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
    training: {
      GK: number | null;
      DEF: number | null;
      MID: number | null;
      ATT: number | null;
    } | null;
  };
  settings: {
    observed: {
      season: number | null;
      week: number | null;
    };
    settings: {
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
  youthPipelineSummary: ClubDashboardYouthPipelineSummary;
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
  settings: {
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
  severity: Severity;
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
  settings: {
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
  severity: Severity;
  confidence: "low" | "medium" | "high";
  timing: string;
}

export interface ClubDashboardYouthPipelineSummary {
  available: boolean;
  detailPath: string;
  observed: {
    snapshotCount: number;
    latestSnapshotDate: string | null;
    seniorPlayerCount: number;
    youngSeniorPlayerCount: number;
    youthAgeThreshold: number;
  };
  settings: {
    academyInvestment: string;
  };
  derived: {
    standoutProspects: number;
    followUpPlayers: number;
    stagnationRiskPlayers: number;
    insufficientDataPlayers: number;
  };
  inferred: {
    headline: string;
    warning: string | null;
    highlightedPlayers: ClubDashboardYouthPipelinePlayer[];
  };
}

export interface ClubDashboardYouthPipelinePlayer {
  playerId: string | null;
  name: string;
  signal: YouthPipelineCategory;
  severity: Severity;
  confidence: "low" | "medium" | "high";
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
  "sale_candidate" | "protection_candidate" | "follow_up" | "insufficient_signal";

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
  settings: {
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
  severity: Severity;
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
  severity: Severity;
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
  countryDetails: {
    name: string;
    currencyName: string;
    currencyRate: number;
  } | null;
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
  settings: {
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
  severity: Severity;
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
  settings: {
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
  severity: Severity;
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

export interface YouthPipelinePlanning {
  clubId: string;
  snapshotId: string | null;
  snapshotDate: string | null;
  observed: {
    youthAgeThreshold: number;
    players: YouthPipelineObservedPlayer[];
    coverage: {
      seniorPlayerCount: number;
      youngSeniorPlayerCount: number;
      playersWithStableIdentity: number;
      playersWithCompleteSkills: number;
    };
  };
  settings: {
    academyInvestment: string;
  };
  derived: {
    categoryCounts: Record<YouthPipelineCategory, number>;
    players: YouthPipelinePlayerPlan[];
  };
  warnings: YouthPipelineWarning[];
}

export interface YouthPipelineObservedPlayer {
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
  skills: Record<string, number | null>;
}

export interface YouthPipelinePlayerPlan {
  playerId: string | null;
  snapshotPlayerId: string;
  name: string;
  age: number;
  role: YouthPipelinePlayerPlanRole;
  category: YouthPipelineCategory;
  severity: Severity;
  confidence: "low" | "medium" | "high";
  rationale: string;
  context: YouthPipelinePlayerContext;
  signals: YouthPipelineSignal[];
  warnings: YouthPipelineWarning[];
}

export interface YouthPipelinePlayerPlanRole {
  label: string;
  source: YouthPipelinePlayerPlaneRoleSource;
}

export type YouthPipelinePlayerPlaneRoleSource = "observed" | "inferred" | "unknown";

export interface YouthPipelinePlayerContext {
  window: {
    from: string | null;
    to: string | null;
    snapshotCount: number;
  };
  dataCompleteness: {
    completeSkills: boolean;
    comparableSkills: number;
  };
  valueAndWage: {
    wage: number;
    wageCurrency: string | null;
    estimatedValue: number;
    estimatedValueCurrency: string | null;
    valueDeltaPercent: number | null;
    wageDeltaPercent: number | null;
  };
  limits: string[];
}

export interface YouthPipelineSignal {
  code: string;
  severity: Severity;
  confidence: "low" | "medium" | "high";
  message: string;
  evidence: YouthPipelineEvidence[];
}

export interface YouthPipelineWarning {
  code: string;
  message: string;
  evidence: YouthPipelineEvidence[];
}

export interface YouthPipelineEvidence {
  kind: SquadEconomyEvidenceKind;
  label: string;
  value: string | number | null;
}

export type RealYouthAcademyCategory =
  | "standout_prospect"
  | "ready_for_promotion"
  | "follow_up"
  | "stagnation_risk"
  | "insufficient_data";

export interface RealYouthAcademyPlanning {
  clubId: string;
  snapshotId: string | null;
  snapshotDate: string | null;
  observed: {
    players: RealYouthAcademyObservedPlayer[];
    coverage: {
      totalYouthCount: number;
      youthsWithWeeksRemaining: number;
      youthsWithEstimatedLevel: number;
    };
    weeklyInvestment: { amount: number; currency: string | null } | null;
  };
  settings: {
    academyInvestment: string;
  };
  derived: {
    categoryCounts: Record<RealYouthAcademyCategory, number>;
    players: RealYouthAcademyPlayerPlan[];
  };
  warnings: RealYouthAcademyWarning[];
}

export interface RealYouthAcademyObservedPlayer {
  id: string;
  externalId: string | null;
  name: string;
  age: number;
  weeksInAcademy: number | null;
  weeksRemaining: number | null;
  estimatedLevel: string | null;
  status: "in_academy" | "ready_for_promotion" | "promoted";
}

export interface RealYouthAcademyPlayerPlan {
  id: string;
  externalId: string | null;
  name: string;
  age: number;
  weeksInAcademy: number | null;
  weeksRemaining: number | null;
  projectedPromotionAge: number | null;
  estimatedLevel: string | null;
  status: "in_academy" | "ready_for_promotion" | "promoted";
  category: RealYouthAcademyCategory;
  severity: Severity;
  confidence: "low" | "medium" | "high";
  rationale: string;
  signals: RealYouthAcademySignal[];
  warnings: RealYouthAcademyWarning[];
}

export interface RealYouthAcademySignal {
  code: string;
  severity: Severity;
  confidence: "low" | "medium" | "high";
  message: string;
  evidence: RealYouthAcademyEvidence[];
}

export interface RealYouthAcademyWarning {
  code: string;
  message: string;
  evidence: RealYouthAcademyEvidence[];
}

export interface RealYouthAcademyEvidence {
  kind: SquadEconomyEvidenceKind;
  label: string;
  value: string | number | null;
}

