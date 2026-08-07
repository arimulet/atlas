export type MarketStrategy = "conservative" | "balanced" | "opportunistic";
export type MarketPlanningCategory =
  | "sale_candidate"
  | "protection_candidate"
  | "follow_up"
  | "insufficient_signal";
export type MarketPlanningSeverity = "info" | "low" | "medium" | "high";
export type MarketPlanningConfidence = "low" | "medium" | "high";
export type EvidenceKind = "observed" | "manual" | "derived" | "inferred";

export interface GetSquadMarketPlanningInput {
  clubId: string;
}

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
    marketStrategy: MarketStrategy;
  };
  derived: {
    categoryCounts: Record<MarketPlanningCategory, number>;
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
  wage: {
    amount: number;
    currency: string | null;
  };
  estimatedValue: {
    amount: number;
    currency: string | null;
  };
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
  category: MarketPlanningCategory;
  severity: MarketPlanningSeverity;
  confidence: MarketPlanningConfidence;
  rationale: string;
  timing: SquadMarketTiming;
  signals: SquadMarketSignal[];
  warnings: SquadMarketWarning[];
}

export interface SquadMarketSignal {
  code: string;
  severity: MarketPlanningSeverity;
  confidence: MarketPlanningConfidence;
  message: string;
  evidence: SquadMarketEvidence[];
}

export interface SquadMarketWarning {
  code: string;
  message: string;
  evidence: SquadMarketEvidence[];
}

export interface SquadMarketEvidence {
  kind: EvidenceKind;
  label: string;
  value: string | number | null;
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
