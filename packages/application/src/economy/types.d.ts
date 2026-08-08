import { Severity } from "../playerDevelopment/types";
import { Confidence } from "../types";

type EconomyRiskTolerance = "conservative" | "balanced" | "aggressive";

export interface GetSquadEconomyInput {
  clubId: string;
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
    riskTolerance: EconomyRiskTolerance;
  };
  derived: {
    totalWage: SquadEconomyMoneyTotal;
    totalEstimatedValue: SquadEconomyMoneyTotal;
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
  wage: SnapshotMoney;
  estimatedValue: SnapshotMoney;
}

export interface SquadEconomyMoneyTotal {
  amount: number;
  currency: string | null;
  isComplete: boolean;
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
  wage: SnapshotMoney;
  estimatedValue: SnapshotMoney;
  wageShare: number | null;
  estimatedValueShare: number | null;
  wageToValueRatio: number | null;
  warnings: SquadEconomyWarning[];
}

export interface SquadEconomyHistoricalSnapshot {
  snapshotId: string;
  snapshotDate: string;
  totalWage: SquadEconomyMoneyTotal;
  totalEstimatedValue: SquadEconomyMoneyTotal;
  wageToValueRatio: number | null;
}

export interface SquadEconomyFinding {
  code: string;
  severity: Severity;
  confidence: Confidence;
  title: string;
  description: string;
  evidence: Array<{
    kind: "observed" | "manual" | "derived" | "inferred";
    label: string;
    value: string | number | null;
  }>;
}

export interface SquadEconomyWarning {
  code: string;
  message: string;
  evidence: Array<{
    kind: "observed" | "manual" | "derived" | "inferred";
    label: string;
    value: string | number | null;
  }>;
}