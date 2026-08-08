import { Severity } from "../playerDevelopment/types";
import { ClubId, Confidence, EvidenceKind, Money, RoleSource } from "../types";

export type MarketStrategy = "conservative" | "balanced" | "opportunistic";
export type MarketPlanningCategory =
  "sale_candidate" | "protection_candidate" | "follow_up" | "insufficient_signal";

export interface GetSquadMarketPlanningInput {
  clubId: string;
}

export interface SquadMarketPlanning {
  clubId: ClubId;
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
    source: RoleSource;
  };
  wage: Money;
  estimatedValue: Money;
}

export interface SquadMarketPlayerPlan {
  playerId: string | null;
  snapshotPlayerId: string;
  name: string;
  age: number;
  role: {
    label: string;
    source: RoleSource;
  };
  category: MarketPlanningCategory;
  severity: Severity;
  confidence: Confidence;
  rationale: string;
  timing: SquadMarketTiming;
  signals: SquadMarketSignal[];
  warnings: SquadMarketWarning[];
}

export interface SquadMarketSignal {
  code: string;
  severity: Severity;
  confidence: Confidence;
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
  value?: string | number;
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
