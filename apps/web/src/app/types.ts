import type { ReactNode } from "react";
import type { MainViewId } from "./routing";
import type {
  AdvancedTrainingOptimization,
  PlayerTrainingRecommendation,
  SquadDepthAnalysis,
  SquadDepthPlayer,
  SquadPlanningRecommendations,
  SquadRole,
  SquadRoleAssignment,
  WeeklyTrainingReport
} from "@atlas/domain";
export type { 
  YouthDecisionPlanning,
  YouthMatchPerformancesDto,
  YouthPlayerMatchPerformanceDto,
  YouthPlayerMatchRating
} from "@atlas/application";

export type { SquadRole } from "@atlas/domain";

export type ViewId = MainViewId | "player-detail";

export interface NavigationItem {
  id: MainViewId;
  label: string;
  icon: ReactNode;
  path: string;
}

export interface NavigationGroup {
  id: string;
  label: string;
  items: NavigationItem[];
}

export type DashboardStatus = "idle" | "loading" | "ready" | "error";

export interface SquadPlanningData {
  players: SquadDepthPlayer[];
  summary: Record<SquadRole, number>;
  manualAssignments: SquadRoleAssignment[];
  currentGameWeek: number | null;
  depthPlayers: SquadDepthPlayer[];
}

export interface SquadPlanningBundle {
  assessment: SquadPlanningData;
  depth: SquadDepthAnalysis;
  recommendations: SquadPlanningRecommendations;
}
export type SourceKind = "observed" | "manual" | "effective";
export type SquadEconomyEvidenceKind = "observed" | "manual" | "derived" | "inferred";
export type SkillChangeDirection = "up" | "down" | "stable" | "insufficient_data";
export type PlayerDevelopmentFindingType =
  "improvement" | "stagnation" | "decline" | "insufficient_data";
export type YouthPipelineCategory =
  "standout_prospect" | "follow_up" | "stagnation_risk" | "insufficient_data";
export type SquadMarketCategory =
  "sale_candidate" | "protection_candidate" | "follow_up" | "insufficient_signal";

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
  currency: CurrencySettings;
  totalValue: MoneyTotal;
  totalWage: MoneyTotal;
  incompletePlayerCount: number;
}

export type DiagnosticParameterValue = string | number | null;
export type DiagnosticParameters = Record<string, DiagnosticParameterValue>;

export interface DiagnosticTrace {
  kind: "observed" | "derived" | "assumed" | "recommended";
  code: string;
  value: string | number | null;
  parameters?: DiagnosticParameters;
}

export interface DiagnosticAssumption {
  code: string;
  traceKind: "assumed";
  parameters?: DiagnosticParameters;
}

export interface DiagnosticRecommendation {
  code: string;
  traceKind: "recommended";
  parameters?: DiagnosticParameters;
}

export interface DiagnosticFinding {
  code: string;
  category: string;
  severity: Severity;
  parameters?: DiagnosticParameters;
  evidence: DiagnosticTrace[];
  assumptions: DiagnosticAssumption[];
  confidence: "low" | "medium" | "high";
  affectedPlayerIds: string[];
  recommendations: DiagnosticRecommendation[];
}

export type Severity = "info" | "low" | "medium" | "high";

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

export interface CurrencySettings {
  name: string;
  rate: number;
}

export type OperatingPreferenceKey =
  "economy.riskTolerance" | "training.priority" | "academy.investment" | "market.strategy";

export interface ClubDashboard {
  club: {
    id: string;
    clubId: number;
    name: string;
    currency: string;
    budget: number | null;
    gameWeek: number | null;
    week: number | null;
    lastSnapshotDate: string | null;
    observedAt: string | null;
    settings: {
      assumptions: ManualRecord[];
      preferences: ManualRecord[];
    };
    profile: {
      externalId: string | null;
      name: string;
      currency: string;
      week: number | null;
    };
    training: {
      GK: number;
      DEF: number;
      MID: number;
      ATT: number;
    };
  };
  settings: {
    observed: {
      week: number | null;
    };
    settings: {
      week: number | null;
      preferences: Partial<Record<OperatingPreferenceKey, string>>;
    };
    effective: {
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
  trainingSummary: ClubDashboardTrainingSummary;
  developmentSummary: ClubDashboardDevelopmentSummary;
  marketSummary: ClubDashboardMarketSummary;
  youthPipelineSummary: ClubDashboardYouthPipelineSummary;
  operationalAreas: OperationalArea[];
}

export interface ClubDashboardTrainingSummary {
  available: boolean;
  observed: {
    latestSnapshotDate: string | null;
    playerCount: number;
    playersWithTrainingData: number;
    advancedPlayers: number;
    formationPlayers: number;
  };
}

export interface TrainingPageData {
  snapshotId: string | null;
  snapshotDate: string | null;
  configuration: {
    GK: number;
    DEF: number;
    MID: number;
    ATT: number;
  } | null;
  players: TrainingPagePlayer[];
  history?: TrainingReport[];
}

export type WeeklyTrainingReportResponse = Omit<WeeklyTrainingReport, "date"> & {
  date: string;
};

export interface WeeklyTrainingIntelligence {
  report: WeeklyTrainingReportResponse;
  recommendations: PlayerTrainingRecommendation[];
  advancedOptimization: AdvancedTrainingOptimization;
}

export interface TrainingReport {
  id?: string;
  playerId: number;
  gameWeek: number;
  season?: number | null;
  seasonWeek: number;
  date: string;
  type: string;
  kind: "advanced" | "formation" | "missing";
  intensity: number;
  age: number;
  skills: Record<string, number | undefined>;
  skillsChange: Record<string, number>;
  skillChanges?: TrainingSkillChange[];
}

export interface TrainingSkillChange {
  skill: string;
  before: number;
  after: number;
  delta: number;
  direction: "up" | "down";
}

export interface TrainingPagePlayer {
  id: string;
  playerId: number;
  name: string;
  countryName?: string | null;
  age: number;
  form?: number | null;
  training: {
    position: number;
    advanced: boolean;
  };
  value?: number | null;
  valueChange?: number | null;
  latestReport?: TrainingReport | null;
  talentEstimate?: TalentEstimate | null;
}

export interface TalentEstimate {
  value: number | null;
  confidence: "unknown" | "low" | "medium" | "high";
  evidenceCount: number;
  evidences: TalentEvidence[];
}

export interface TalentEvidence {
  playerId: number;
  skill: string;
  fromLevel: number;
  toLevel: number;
  fromWeek: number;
  toWeek: number;
  trainingWeeks: number;
  accumulatedTrainingPoints: number;
  estimatedTalent: number;
  confidence: number;
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
  gameWeek: number | null;
  week: number | null;
  playerCount: number;
}

export interface OperationalArea {
  key: string;
  label: string;
  status: "available" | "ready" | "planned";
  summary: string;
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
  manual: {
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
  value: { amount: number; currency: string | null };
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
    valueCurrency: string | null;
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
      youthsWithSkill: number;
    };
    source: "snapshot.juniors";
  };
  manual: {
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
  playerId?: number;
  externalId: string | null;
  name: string;
  age: number;
  initialLevel: number | null;
  initialWeeks: number | null;
  weeksInAcademy: number | null;
  weeksRemaining: number | null;
  skill: number | null;
  status: "in_academy" | "ready_for_promotion" | "promoted";
}

export interface RealYouthAcademyPlayerPlan {
  id: string;
  playerId?: number;
  externalId: string | null;
  name: string;
  age: number;
  initialLevel: number | null;
  initialWeeks: number | null;
  weeksInAcademy: number | null;
  weeksRemaining: number | null;
  projectedPromotionAge: number | null;
  skill: number | null;
  skillChange: number | null;
  levelPops: number | null;
  talent: number | null;
  expectedLevel: number | null;
  formation: number | null;
  observations: string;
  status: "in_academy" | "ready_for_promotion" | "promoted";
  category: RealYouthAcademyCategory;
  severity: Severity;
  confidence: "low" | "medium" | "high";
  rationale: string;
  signals: RealYouthAcademySignal[];
  warnings: RealYouthAcademyWarning[];
  history: YouthSkillHistoryEntry[];
}

export interface YouthSkillHistoryEntry {
  gameWeek: number;
  season: number;
  seasonWeek: number;
  skill: number;
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
