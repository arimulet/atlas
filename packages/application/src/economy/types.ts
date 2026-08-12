import { type PersistedCountry } from "@atlas/database";
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
      playersWithValue: number;
      wageCurrency: string | null;
      valueCurrency: string | null;
    };
  };
  manual: {
    currency: { name: string; rate: number };
    riskTolerance: EconomyRiskTolerance;
  };
  derived: {
    totalWage: Money;
    totalValue: Money;
    wageToValueRatio: number | null;
    playerDetails: SquadEconomyPlayerDetail[];
    concentration: {
      wage: SquadEconomyConcentration[];
      value: SquadEconomyConcentration[];
    };
  };
  historical: {
    comparableSnapshotCount: number;
    previousSnapshot: SquadEconomyHistoricalSnapshot | null;
    currentSnapshot: SquadEconomyHistoricalSnapshot | null;
    changes: {
      totalWageDelta: number | null;
      totalWageDeltaPercent: number | null;
      totalValueDelta: number | null;
      totalValueDeltaPercent: number | null;
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
  wage: Money;
  value: Money;
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
  wage: Money;
  value: Money;
  wageShare: number | null;
  valueShare: number | null;
  wageToValueRatio: number | null;
  warnings: SquadEconomyWarning[];
}

export interface SquadEconomyHistoricalSnapshot {
  snapshotId: string;
  snapshotDate: string;
  totalWage: Money;
  totalValue: Money;
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
