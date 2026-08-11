import { type SnapshotMoney, type PersistedCountry } from "@atlas/database";
import { ClubId, Confidence, EvidenceKind, Money, Severity } from "@atlas/application";

export type EconomyRiskTolerance = "conservative" | "balanced" | "aggressive";

export interface SquadEconomy {
  clubId: ClubId;
  countryDetails: PersistedCountry | null;
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
    currency: { name: string; rate: number };
    riskTolerance: EconomyRiskTolerance;
  };
  derived: {
    totalWage: Money;
    totalEstimatedValue: Money;
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
  playerId: number | null;
  snapshotPlayerId: string;
  name: string;
  age: number;
  wage: SnapshotMoney;
  estimatedValue: SnapshotMoney;
}

export interface SquadEconomyConcentration {
  playerId: number | null;
  snapshotPlayerId: string;
  name: string;
  amount: number;
  currency: string | null;
  share: number | null;
}

export interface SquadEconomyPlayerDetail {
  playerId: number | null;
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
  totalWage: Money;
  totalEstimatedValue: Money;
  wageToValueRatio: number | null;
}

export interface SquadEconomyFinding {
  code: string;
  severity: Severity;
  confidence: Confidence;
  title: string;
  description: string;
  evidence: Array<{
    kind: EvidenceKind;
    label: string;
    value: string | number | null;
  }>;
}

export interface SquadEconomyWarning {
  code: string;
  message: string;
  evidence: Array<{
    kind: EvidenceKind;
    label: string;
    value: string | number | null;
  }>;
}
