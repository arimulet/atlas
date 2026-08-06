import {
  MongoClubRepository,
  MongoSnapshotRepository,
  type PersistedPlayerSnapshot,
  type PersistedSnapshot,
  type SnapshotMoney
} from "@atlas/database";
import { buildClubOperatingSettings } from "./clubOperatingSettings.js";

type EconomyRiskTolerance = "conservative" | "balanced" | "aggressive";
type SquadEconomySeverity = "info" | "low" | "medium" | "high";
type SquadEconomyConfidence = "low" | "medium" | "high";

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

export interface SquadEconomyHistoricalSnapshot {
  snapshotId: string;
  snapshotDate: string;
  totalWage: SquadEconomyMoneyTotal;
  totalEstimatedValue: SquadEconomyMoneyTotal;
  wageToValueRatio: number | null;
}

export interface SquadEconomyFinding {
  code: string;
  severity: SquadEconomySeverity;
  confidence: SquadEconomyConfidence;
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

const clubRepository = new MongoClubRepository();
const snapshotRepository = new MongoSnapshotRepository();

export async function getSquadEconomy(input: GetSquadEconomyInput): Promise<SquadEconomy> {
  const club = await clubRepository.findById(input.clubId);

  if (!club) {
    throw new Error(`Club not found: ${input.clubId}`);
  }

  const settings = buildClubOperatingSettings(club);
  const riskTolerance = settings.effective.preferences["economy.riskTolerance"] as EconomyRiskTolerance;
  const snapshots = await snapshotRepository.listByClub(input.clubId);
  const latest = snapshots.at(-1) ?? null;

  if (!latest) {
    return buildEmptySquadEconomy(input.clubId, settings.effective.currency, riskTolerance);
  }

  const observed = buildObserved(latest);
  const derived = buildDerived(latest, observed);
  const warnings = buildWarnings(latest, observed, derived, settings.effective.currency);
  const historical = buildHistorical(snapshots, settings.effective.currency, warnings);
  const findings = buildFindings(derived, historical, riskTolerance, warnings);

  return {
    clubId: input.clubId,
    snapshotId: latest.id,
    snapshotDate: formatDate(latest.snapshotDate),
    observed,
    manual: {
      currency: settings.effective.currency,
      riskTolerance
    },
    derived,
    historical,
    findings,
    warnings
  };
}

function buildEmptySquadEconomy(
  clubId: string,
  currency: string | null,
  riskTolerance: EconomyRiskTolerance
): SquadEconomy {
  return {
    clubId,
    snapshotId: null,
    snapshotDate: null,
    observed: {
      players: [],
      coverage: {
        playerCount: 0,
        playersWithWage: 0,
        playersWithEstimatedValue: 0,
        wageCurrency: null,
        estimatedValueCurrency: null
      }
    },
    manual: {
      currency,
      riskTolerance
    },
    derived: {
      totalWage: { amount: 0, currency, isComplete: false },
      totalEstimatedValue: { amount: 0, currency, isComplete: false },
      wageToValueRatio: null,
      concentration: {
        wage: [],
        estimatedValue: []
      }
    },
    historical: {
      comparableSnapshotCount: 0,
      previousSnapshot: null,
      currentSnapshot: null,
      changes: {
        totalWageDelta: null,
        totalWageDeltaPercent: null,
        totalEstimatedValueDelta: null,
        totalEstimatedValueDeltaPercent: null,
        wageToValueRatioDelta: null
      }
    },
    findings: [],
    warnings: [
      {
        code: "no_snapshots",
        message: "Economia de plantilla necesita al menos un snapshot de plantilla importado.",
        evidence: [{ kind: "observed", label: "Snapshots disponibles", value: 0 }]
      }
    ]
  };
}

function buildObserved(snapshot: PersistedSnapshot): SquadEconomy["observed"] {
  const players = snapshot.players.map((player) => ({
    playerId: player.playerId,
    snapshotPlayerId: player.id,
    name: player.name,
    age: player.age,
    wage: player.wage,
    estimatedValue: player.estimatedValue
  }));

  return {
    players,
    coverage: {
      playerCount: players.length,
      playersWithWage: players.filter((player) => hasPositiveAmount(player.wage)).length,
      playersWithEstimatedValue: players.filter((player) => hasPositiveAmount(player.estimatedValue))
        .length,
      wageCurrency: readSingleCurrency(players.map((player) => player.wage.currency)),
      estimatedValueCurrency: readSingleCurrency(players.map((player) => player.estimatedValue.currency))
    }
  };
}

function buildDerived(
  snapshot: PersistedSnapshot,
  observed: SquadEconomy["observed"]
): SquadEconomy["derived"] {
  const totalWage = sumMoney(snapshot.players.map((player) => player.wage));
  const totalEstimatedValue = sumMoney(snapshot.players.map((player) => player.estimatedValue));

  return {
    totalWage: {
      ...totalWage,
      isComplete: observed.coverage.playersWithWage === observed.coverage.playerCount
    },
    totalEstimatedValue: {
      ...totalEstimatedValue,
      isComplete: observed.coverage.playersWithEstimatedValue === observed.coverage.playerCount
    },
    wageToValueRatio:
      totalEstimatedValue.amount > 0 ? roundRatio(totalWage.amount / totalEstimatedValue.amount) : null,
    concentration: {
      wage: buildConcentration(snapshot.players, "wage", totalWage.amount),
      estimatedValue: buildConcentration(snapshot.players, "estimatedValue", totalEstimatedValue.amount)
    }
  };
}

function buildHistorical(
  snapshots: PersistedSnapshot[],
  effectiveCurrency: string | null,
  warnings: SquadEconomyWarning[]
): SquadEconomy["historical"] {
  const comparable = snapshots.filter((snapshot) => isComparableSnapshot(snapshot, effectiveCurrency));
  const current = comparable.at(-1) ?? null;
  const previous = comparable.at(-2) ?? null;

  if (!current || !previous) {
    warnings.push({
      code: "insufficient_history",
      message: "La lectura historica requiere al menos dos snapshots comparables.",
      evidence: [{ kind: "observed", label: "Snapshots comparables", value: comparable.length }]
    });
  }

  const currentSummary = current ? buildHistoricalSnapshot(current) : null;
  const previousSummary = previous ? buildHistoricalSnapshot(previous) : null;

  return {
    comparableSnapshotCount: comparable.length,
    previousSnapshot: previousSummary,
    currentSnapshot: currentSummary,
    changes:
      currentSummary && previousSummary
        ? {
            totalWageDelta: currentSummary.totalWage.amount - previousSummary.totalWage.amount,
            totalWageDeltaPercent: percentDelta(
              previousSummary.totalWage.amount,
              currentSummary.totalWage.amount
            ),
            totalEstimatedValueDelta:
              currentSummary.totalEstimatedValue.amount - previousSummary.totalEstimatedValue.amount,
            totalEstimatedValueDeltaPercent: percentDelta(
              previousSummary.totalEstimatedValue.amount,
              currentSummary.totalEstimatedValue.amount
            ),
            wageToValueRatioDelta:
              currentSummary.wageToValueRatio !== null && previousSummary.wageToValueRatio !== null
                ? roundRatio(currentSummary.wageToValueRatio - previousSummary.wageToValueRatio)
                : null
          }
        : {
            totalWageDelta: null,
            totalWageDeltaPercent: null,
            totalEstimatedValueDelta: null,
            totalEstimatedValueDeltaPercent: null,
            wageToValueRatioDelta: null
          }
  };
}

function buildWarnings(
  snapshot: PersistedSnapshot,
  observed: SquadEconomy["observed"],
  derived: SquadEconomy["derived"],
  effectiveCurrency: string | null
): SquadEconomyWarning[] {
  const warnings: SquadEconomyWarning[] = [];

  if (!effectiveCurrency && (!observed.coverage.wageCurrency || !observed.coverage.estimatedValueCurrency)) {
    warnings.push({
      code: "missing_currency",
      message: "Falta moneda efectiva u observada; los importes se muestran como evidencia monetaria no comparable.",
      evidence: [
        { kind: "manual", label: "Moneda efectiva", value: effectiveCurrency },
        { kind: "observed", label: "Moneda salario", value: observed.coverage.wageCurrency },
        { kind: "observed", label: "Moneda valor", value: observed.coverage.estimatedValueCurrency }
      ]
    });
  }

  if (!derived.totalWage.isComplete || !derived.totalEstimatedValue.isComplete) {
    warnings.push({
      code: "partial_player_economy_data",
      message: "Hay jugadores sin salario o valor estimado positivo; los totales reflejan solo evidencia disponible.",
      evidence: [
        { kind: "observed", label: "Jugadores", value: snapshot.players.length },
        { kind: "observed", label: "Con salario", value: observed.coverage.playersWithWage },
        { kind: "observed", label: "Con valor estimado", value: observed.coverage.playersWithEstimatedValue }
      ]
    });
  }

  return warnings;
}

function buildFindings(
  derived: SquadEconomy["derived"],
  historical: SquadEconomy["historical"],
  riskTolerance: EconomyRiskTolerance,
  warnings: SquadEconomyWarning[]
): SquadEconomyFinding[] {
  const findings: SquadEconomyFinding[] = [];
  const topWage = derived.concentration.wage[0] ?? null;
  const topValue = derived.concentration.estimatedValue[0] ?? null;
  const confidence = warnings.length > 0 ? "low" : "medium";

  if (topWage && topWage.share !== null && topWage.share >= concentrationLimit(riskTolerance)) {
    findings.push({
      code: "salary_concentration",
      severity: severityForRiskTolerance(riskTolerance, "medium"),
      confidence,
      title: "Concentracion salarial relevante",
      description: "Un jugador concentra una parte alta de la masa salarial observada.",
      evidence: [
        { kind: "observed", label: "Jugador", value: topWage.name },
        { kind: "derived", label: "Participacion salarial", value: roundPercent(topWage.share) },
        { kind: "manual", label: "Tolerancia de riesgo", value: riskTolerance }
      ]
    });
  }

  if (topValue && topValue.share !== null && topValue.share >= 0.35) {
    findings.push({
      code: "asset_concentration",
      severity: "medium",
      confidence,
      title: "Concentracion patrimonial relevante",
      description: "Una parte material del valor estimado de la plantilla depende de un jugador.",
      evidence: [
        { kind: "observed", label: "Jugador", value: topValue.name },
        { kind: "derived", label: "Participacion de valor", value: roundPercent(topValue.share) }
      ]
    });
  }

  if (
    historical.changes.totalWageDeltaPercent !== null &&
    historical.changes.totalEstimatedValueDeltaPercent !== null &&
    historical.changes.totalWageDeltaPercent > 0.15 &&
    historical.changes.totalEstimatedValueDeltaPercent < 0.05
  ) {
    findings.push({
      code: "wage_growth_without_asset_growth",
      severity: severityForRiskTolerance(riskTolerance, "high"),
      confidence: warnings.length > 0 ? "low" : "medium",
      title: "Salario crece sin mejora patrimonial proporcional",
      description: "La masa salarial subio mas rapido que el valor estimado comparable.",
      evidence: [
        {
          kind: "derived",
          label: "Variacion masa salarial",
          value: roundPercent(historical.changes.totalWageDeltaPercent)
        },
        {
          kind: "derived",
          label: "Variacion valor estimado",
          value: roundPercent(historical.changes.totalEstimatedValueDeltaPercent)
        },
        { kind: "manual", label: "Tolerancia de riesgo", value: riskTolerance }
      ]
    });
  }

  if (findings.length === 0 && warnings.length === 0) {
    findings.push({
      code: "squad_economy_baseline",
      severity: "info",
      confidence: "medium",
      title: "Lectura base disponible",
      description: "No aparecen senales fuertes con la evidencia actual de Economia de plantilla.",
      evidence: [
        { kind: "derived", label: "Masa salarial", value: derived.totalWage.amount },
        { kind: "derived", label: "Valor estimado", value: derived.totalEstimatedValue.amount }
      ]
    });
  }

  return findings;
}

function buildHistoricalSnapshot(snapshot: PersistedSnapshot): SquadEconomyHistoricalSnapshot {
  const observed = buildObserved(snapshot);
  const derived = buildDerived(snapshot, observed);

  return {
    snapshotId: snapshot.id,
    snapshotDate: formatDate(snapshot.snapshotDate),
    totalWage: derived.totalWage,
    totalEstimatedValue: derived.totalEstimatedValue,
    wageToValueRatio: derived.wageToValueRatio
  };
}

function buildConcentration(
  players: PersistedPlayerSnapshot[],
  field: "wage" | "estimatedValue",
  total: number
): SquadEconomyConcentration[] {
  return players
    .map((player) => ({
      playerId: player.playerId,
      snapshotPlayerId: player.id,
      name: player.name,
      amount: player[field].amount,
      currency: player[field].currency,
      share: total > 0 ? roundRatio(player[field].amount / total) : null
    }))
    .sort((first, second) => second.amount - first.amount);
}

function isComparableSnapshot(snapshot: PersistedSnapshot, effectiveCurrency: string | null): boolean {
  const currencies = snapshot.players.flatMap((player) => [
    player.wage.currency ?? effectiveCurrency,
    player.estimatedValue.currency ?? effectiveCurrency
  ]);

  return currencies.every((currency) => currency && currency === currencies[0]);
}

function sumMoney(values: SnapshotMoney[]): { amount: number; currency: string | null } {
  return {
    amount: values.reduce((total, money) => total + money.amount, 0),
    currency: readSingleCurrency(values.map((money) => money.currency))
  };
}

function readSingleCurrency(currencies: Array<string | null>): string | null {
  const unique = new Set(currencies.filter(Boolean));
  return unique.size === 1 ? [...unique][0] ?? null : null;
}

function hasPositiveAmount(money: SnapshotMoney): boolean {
  return money.amount > 0;
}

function concentrationLimit(riskTolerance: EconomyRiskTolerance): number {
  if (riskTolerance === "conservative") return 0.25;
  if (riskTolerance === "aggressive") return 0.4;
  return 0.32;
}

function severityForRiskTolerance(
  riskTolerance: EconomyRiskTolerance,
  base: Exclude<SquadEconomySeverity, "info" | "low">
): SquadEconomySeverity {
  if (riskTolerance === "conservative" && base === "medium") return "high";
  if (riskTolerance === "aggressive" && base === "high") return "medium";
  return base;
}

function percentDelta(previous: number, current: number): number | null {
  return previous > 0 ? roundRatio((current - previous) / previous) : null;
}

function roundRatio(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function roundPercent(value: number): number {
  return Math.round(value * 1000) / 10;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
