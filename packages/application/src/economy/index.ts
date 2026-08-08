import {
  MongoClubRepository,
  MongoSnapshotRepository,
  type PersistedPlayerSnapshot,
  type PersistedSnapshot,
  type SnapshotMoney
} from "@atlas/database";
import { buildClubOperatingSettings } from "../clubOperatingSettings/index.js";
import { EconomyRiskTolerance, GetSquadEconomyInput, SquadEconomy, SquadEconomyConcentration, SquadEconomyFinding, SquadEconomyHistoricalSnapshot, SquadEconomyPlayerDetail, SquadEconomyWarning } from "./types.js";
import { Confidence, Severity } from "../types.js";

const clubRepository = new MongoClubRepository();
const snapshotRepository = new MongoSnapshotRepository();

export const getSquadEconomy = async (input: GetSquadEconomyInput): Promise<SquadEconomy> => {
  const club = await clubRepository.findById(input.clubId);

  if (!club) {
    throw new Error(`Club not found: ${input.clubId}`);
  }

  const settings = buildClubOperatingSettings(club);
  const riskTolerance = settings.effective.preferences[
    "economy.riskTolerance"
  ] as EconomyRiskTolerance;
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
      playerDetails: [],
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
      playersWithEstimatedValue: players.filter((player) =>
        hasPositiveAmount(player.estimatedValue)
      ).length,
      wageCurrency: readSingleCurrency(players.map((player) => player.wage.currency)),
      estimatedValueCurrency: readSingleCurrency(
        players.map((player) => player.estimatedValue.currency)
      )
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
      totalEstimatedValue.amount > 0
        ? roundRatio(totalWage.amount / totalEstimatedValue.amount)
        : null,
    playerDetails: buildPlayerDetails(
      snapshot.players,
      totalWage.amount,
      totalEstimatedValue.amount
    ),
    concentration: {
      wage: buildConcentration(snapshot.players, "wage", totalWage.amount),
      estimatedValue: buildConcentration(
        snapshot.players,
        "estimatedValue",
        totalEstimatedValue.amount
      )
    }
  };
}

function buildHistorical(
  snapshots: PersistedSnapshot[],
  effectiveCurrency: string | null,
  warnings: SquadEconomyWarning[]
): SquadEconomy["historical"] {
  const comparable = snapshots.filter((snapshot) =>
    isComparableSnapshot(snapshot, effectiveCurrency)
  );
  const current = comparable.at(-1) ?? null;
  const previous = comparable.at(-2) ?? null;

  if (!current || !previous) {
    warnings.push({
      code: "insufficient_history",
      message: "La lectura historica requiere al menos dos snapshots comparables.",
      evidence: [{ kind: "observed", label: "Snapshots comparables", value: comparable.length }]
    });
  }

  if (snapshots.length >= 2 && comparable.length < 2) {
    warnings.push({
      code: "non_comparable_history",
      message:
        "Existen snapshots historicos, pero no hay dos con moneda comparable para una lectura monetaria prudente.",
      evidence: [
        { kind: "observed", label: "Snapshots del club", value: snapshots.length },
        { kind: "observed", label: "Snapshots comparables", value: comparable.length },
        { kind: "manual", label: "Moneda efectiva", value: effectiveCurrency }
      ]
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
              currentSummary.totalEstimatedValue.amount -
              previousSummary.totalEstimatedValue.amount,
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

  if (
    !effectiveCurrency &&
    (!observed.coverage.wageCurrency || !observed.coverage.estimatedValueCurrency)
  ) {
    warnings.push({
      code: "missing_currency",
      message:
        "Falta moneda efectiva u observada; los importes se muestran como evidencia monetaria no comparable.",
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
      message:
        "Hay jugadores sin salario o valor estimado positivo; los totales reflejan solo evidencia disponible.",
      evidence: [
        { kind: "observed", label: "Jugadores", value: snapshot.players.length },
        { kind: "observed", label: "Con salario", value: observed.coverage.playersWithWage },
        {
          kind: "observed",
          label: "Con valor estimado",
          value: observed.coverage.playersWithEstimatedValue
        }
      ]
    });
  }

  if (
    observed.coverage.wageCurrency &&
    observed.coverage.estimatedValueCurrency &&
    observed.coverage.wageCurrency !== observed.coverage.estimatedValueCurrency
  ) {
    warnings.push({
      code: "mixed_money_currency",
      message:
        "Salarios y valores estimados usan monedas distintas; el ratio salario/valor no es comparable.",
      evidence: [
        { kind: "observed", label: "Moneda salario", value: observed.coverage.wageCurrency },
        { kind: "observed", label: "Moneda valor", value: observed.coverage.estimatedValueCurrency }
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
  const confidence = calculateConfidence(warnings);

  if (topWage && topWage.share !== null && topWage.share >= concentrationLimit(riskTolerance)) {
    const topWageDetail = derived.playerDetails.find(
      (player) => player.snapshotPlayerId === topWage.snapshotPlayerId
    );

    findings.push({
      code: "salary_concentration",
      severity: severityForConcentration(topWage.share, riskTolerance),
      confidence,
      title: "Concentracion salarial relevante",
      description:
        "Un jugador concentra una parte alta de la masa salarial observada. Es una senal relativa de plantilla, no una lectura de caja o liquidez.",
      evidence: [
        { kind: "observed", label: "Jugador", value: topWage.name },
        { kind: "observed", label: "Salario", value: topWage.amount },
        {
          kind: "observed",
          label: "Valor estimado",
          value: topWageDetail?.estimatedValue.amount ?? null
        },
        { kind: "derived", label: "Participacion salarial", value: roundPercent(topWage.share) },
        {
          kind: "derived",
          label: "Ratio salario/valor jugador",
          value: topWageDetail?.wageToValueRatio ?? null
        },
        {
          kind: "derived",
          label: "Umbral aplicado",
          value: roundPercent(concentrationLimit(riskTolerance))
        },
        { kind: "manual", label: "Tolerancia de riesgo", value: riskTolerance }
      ]
    });
  }

  if (topValue && topValue.share !== null && topValue.share >= 0.35) {
    findings.push({
      code: "asset_concentration",
      severity: severityForAssetConcentration(topValue.share),
      confidence,
      title: "Concentracion patrimonial relevante",
      description:
        "Una parte material del valor estimado de la plantilla depende de un jugador. La lectura ayuda a revisar dependencia patrimonial interna.",
      evidence: [
        { kind: "observed", label: "Jugador", value: topValue.name },
        { kind: "observed", label: "Valor estimado", value: topValue.amount },
        { kind: "derived", label: "Participacion de valor", value: roundPercent(topValue.share) },
        { kind: "derived", label: "Umbral medio", value: 35 }
      ]
    });
  }

  const highestRelativeCost = derived.playerDetails.find(
    (player) =>
      player.wageToValueRatio !== null && player.wageToValueRatio >= wageToValueLimit(riskTolerance)
  );

  if (highestRelativeCost) {
    findings.push({
      code: "high_relative_wage_to_value",
      severity: severityForWageToValue(highestRelativeCost.wageToValueRatio, riskTolerance),
      confidence,
      title: "Salario relativo alto frente al valor estimado",
      description:
        "Un jugador muestra una relacion salario/valor elevada dentro de la evidencia disponible. No implica insolvencia ni presupuesto de compras.",
      evidence: [
        { kind: "observed", label: "Jugador", value: highestRelativeCost.name },
        { kind: "observed", label: "Salario", value: highestRelativeCost.wage.amount },
        {
          kind: "observed",
          label: "Valor estimado",
          value: highestRelativeCost.estimatedValue.amount
        },
        {
          kind: "derived",
          label: "Ratio salario/valor jugador",
          value: highestRelativeCost.wageToValueRatio
        },
        { kind: "derived", label: "Umbral aplicado", value: wageToValueLimit(riskTolerance) },
        { kind: "manual", label: "Tolerancia de riesgo", value: riskTolerance }
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
      severity: severityForDeterioration(
        historical.changes.totalWageDeltaPercent,
        historical.changes.totalEstimatedValueDeltaPercent,
        riskTolerance
      ),
      confidence:
        historical.comparableSnapshotCount >= 3 && warnings.length === 0 ? "high" : confidence,
      title: "Salario crece sin mejora patrimonial proporcional",
      description:
        "La masa salarial subio mas rapido que el valor estimado comparable. Es una lectura historica relativa de plantilla.",
      evidence: [
        {
          kind: "observed",
          label: "Snapshots comparables",
          value: historical.comparableSnapshotCount
        },
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
        {
          kind: "derived",
          label: "Cambio ratio salario/valor",
          value: historical.changes.wageToValueRatioDelta
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

function buildPlayerDetails(
  players: PersistedPlayerSnapshot[],
  totalWage: number,
  totalEstimatedValue: number
): SquadEconomyPlayerDetail[] {
  return players
    .map((player) => {
      const wageShare = totalWage > 0 ? roundRatio(player.wage.amount / totalWage) : null;
      const estimatedValueShare =
        totalEstimatedValue > 0
          ? roundRatio(player.estimatedValue.amount / totalEstimatedValue)
          : null;
      const wageToValueRatio =
        player.estimatedValue.amount > 0
          ? roundRatio(player.wage.amount / player.estimatedValue.amount)
          : null;

      return {
        playerId: player.playerId,
        snapshotPlayerId: player.id,
        name: player.name,
        age: player.age,
        wage: player.wage,
        estimatedValue: player.estimatedValue,
        wageShare,
        estimatedValueShare,
        wageToValueRatio,
        warnings: buildPlayerWarnings(player, wageShare, estimatedValueShare, wageToValueRatio)
      };
    })
    .sort((first, second) => {
      const firstRatio = first.wageToValueRatio ?? -1;
      const secondRatio = second.wageToValueRatio ?? -1;

      return secondRatio - firstRatio;
    });
}

function buildPlayerWarnings(
  player: PersistedPlayerSnapshot,
  wageShare: number | null,
  estimatedValueShare: number | null,
  wageToValueRatio: number | null
): SquadEconomyWarning[] {
  const warnings: SquadEconomyWarning[] = [];

  if (!hasPositiveAmount(player.wage) || !hasPositiveAmount(player.estimatedValue)) {
    warnings.push({
      code: "partial_player_detail",
      message: "El detalle del jugador tiene salario o valor estimado incompleto.",
      evidence: [
        { kind: "observed", label: "Salario", value: player.wage.amount },
        { kind: "observed", label: "Valor estimado", value: player.estimatedValue.amount }
      ]
    });
  }

  if (!player.wage.currency || !player.estimatedValue.currency) {
    warnings.push({
      code: "missing_player_currency",
      message: "Falta moneda observada en salario o valor estimado del jugador.",
      evidence: [
        { kind: "observed", label: "Moneda salario", value: player.wage.currency },
        { kind: "observed", label: "Moneda valor", value: player.estimatedValue.currency }
      ]
    });
  }

  if (
    player.wage.currency &&
    player.estimatedValue.currency &&
    player.wage.currency !== player.estimatedValue.currency
  ) {
    warnings.push({
      code: "mixed_player_currency",
      message: "Salario y valor estimado del jugador no estan en la misma moneda.",
      evidence: [
        { kind: "observed", label: "Moneda salario", value: player.wage.currency },
        { kind: "observed", label: "Moneda valor", value: player.estimatedValue.currency }
      ]
    });
  }

  if (
    wageShare !== null &&
    estimatedValueShare !== null &&
    wageToValueRatio !== null &&
    wageShare > estimatedValueShare * 2
  ) {
    warnings.push({
      code: "relative_cost_above_value_share",
      message: "La participacion salarial duplica la participacion de valor estimado.",
      evidence: [
        { kind: "derived", label: "Participacion salarial", value: roundPercent(wageShare) },
        {
          kind: "derived",
          label: "Participacion de valor",
          value: roundPercent(estimatedValueShare)
        },
        { kind: "derived", label: "Ratio salario/valor", value: wageToValueRatio }
      ]
    });
  }

  return warnings;
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

function isComparableSnapshot(
  snapshot: PersistedSnapshot,
  effectiveCurrency: string | null
): boolean {
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
  return unique.size === 1 ? ([...unique][0] ?? null) : null;
}

function hasPositiveAmount(money: SnapshotMoney): boolean {
  return money.amount > 0;
}

function concentrationLimit(riskTolerance: EconomyRiskTolerance): number {
  if (riskTolerance === "conservative") return 0.25;
  if (riskTolerance === "aggressive") return 0.4;
  return 0.32;
}

function wageToValueLimit(riskTolerance: EconomyRiskTolerance): number {
  if (riskTolerance === "conservative") return 0.035;
  if (riskTolerance === "aggressive") return 0.065;
  return 0.05;
}

function severityForConcentration(
  share: number,
  riskTolerance: EconomyRiskTolerance
): Severity {
  const highLimit = concentrationLimit(riskTolerance) + 0.1;

  return share >= highLimit ? "high" : "medium";
}

function severityForAssetConcentration(share: number): Severity {
  if (share >= 0.5) return "high";
  if (share >= 0.35) return "medium";
  return "low";
}

function severityForWageToValue(
  ratio: number | null,
  riskTolerance: EconomyRiskTolerance
): Severity {
  if (ratio === null) return "low";
  if (ratio >= wageToValueLimit(riskTolerance) * 1.6) return "high";
  return "medium";
}

function severityForDeterioration(
  wageDeltaPercent: number,
  valueDeltaPercent: number,
  riskTolerance: EconomyRiskTolerance
): Severity {
  const pressure = wageDeltaPercent - valueDeltaPercent;
  const highLimit = riskTolerance === "aggressive" ? 0.3 : 0.2;

  return pressure >= highLimit ? "high" : "medium";
}

function calculateConfidence(warnings: SquadEconomyWarning[]): Confidence {
  const strongWarningCodes = new Set([
    "missing_currency",
    "mixed_money_currency",
    "non_comparable_history",
    "partial_player_economy_data"
  ]);

  return warnings.some((warning) => strongWarningCodes.has(warning.code)) ? "low" : "medium";
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
