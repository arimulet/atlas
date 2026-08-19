import {
  ClubId,
  MongoClubRepository,
  MongoCountryRepository,
  MongoSnapshotRepository,
  type PersistedPlayerSnapshot,
  type PersistedSnapshot,
  type PersistedCountry
} from "@atlas/database";
import {
  EconomyRiskTolerance,
  SquadEconomy,
  SquadEconomyConcentration,
  SquadEconomyFinding,
  SquadEconomyHistoricalSnapshot,
  SquadEconomyPlayerDetail,
  SquadEconomyWarning
} from "./types.js";
import { Confidence, Money, Severity, buildClubOperatingSettings } from "@atlas/application";
import { formatDate } from "@atlas/utils";

const clubRepository = new MongoClubRepository();
const snapshotRepository = new MongoSnapshotRepository();
const countryRepository = new MongoCountryRepository();

export const getSquadEconomy = async (clubId: ClubId): Promise<SquadEconomy> => {
  const club = await clubRepository.findById(clubId.toString());

  if (!club) {
    throw new Error(`Club not found: ${clubId}`);
  }

  const settings = buildClubOperatingSettings(club);
  const currency = { name: club.currency, rate: 1 };
  const riskTolerance = settings.effective.preferences[
    "economy.riskTolerance"
  ] as EconomyRiskTolerance;
  const snapshots = await snapshotRepository.listByClub(clubId);
  const latest = snapshots.at(-1) ?? null;

  const countryDetails = await countryRepository.getById(club.country);

  if (!latest) {
    return buildEmptySquadEconomy(clubId, currency, riskTolerance, countryDetails);
  }

  const observed = buildObserved(latest, currency);
  const derived = buildDerived(latest, observed, currency);
  const warnings = buildWarnings(latest, observed, derived);
  const historical = buildHistorical(snapshots, currency, warnings);
  const findings = buildFindings(derived, historical, riskTolerance, warnings);

  return {
    clubId,
    countryDetails,
    snapshotId: latest.id,
    snapshotDate: formatDate(latest.snapshotDate),
    observed,
    manual: {
      currency,
      riskTolerance
    },
    derived,
    historical,
    findings,
    warnings
  };
};

function buildEmptySquadEconomy(
  clubId: ClubId,
  currency: { name: string; rate: number },
  riskTolerance: EconomyRiskTolerance,
  countryDetails: PersistedCountry | null
): SquadEconomy {
  return {
    clubId,
    countryDetails,
    snapshotId: null,
    snapshotDate: null,
    observed: {
      players: [],
      coverage: {
        playerCount: 0,
        playersWithWage: 0,
        playersWithValue: 0,
        wageCurrency: null,
        valueCurrency: null
      }
    },
    manual: {
      currency,
      riskTolerance
    },
    derived: {
      totalWage: { amount: 0, currency: currency?.name ?? null, isComplete: false },
      totalValue: { amount: 0, currency: currency?.name ?? null, isComplete: false },
      wageToValueRatio: null,
      playerDetails: [],
      concentration: {
        wage: [],
        value: []
      }
    },
    historical: {
      comparableSnapshotCount: 0,
      previousSnapshot: null,
      currentSnapshot: null,
      changes: {
        totalWageDelta: null,
        totalWageDeltaPercent: null,
        totalValueDelta: null,
        totalValueDeltaPercent: null,
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

function buildObserved(snapshot: PersistedSnapshot, currency: { name: string; rate: number }): SquadEconomy["observed"] {
  const players = snapshot.players.map((player) => ({
    playerId: player.playerId,
    snapshotPlayerId: player.id,
    name: player.name,
    age: player.age,
    wage: toMoney(player.wage, currency.name),
    value: toMoney(player.value, currency.name)
  }));

  return {
    players,
    coverage: {
      playerCount: players.length,
      playersWithWage: players.filter((player) => hasPositiveAmount(player.wage)).length,
      playersWithValue: players.filter((player) =>
        hasPositiveAmount(player.value)
      ).length,
      wageCurrency: currency.name,
      valueCurrency: currency.name
    }
  };
}

function buildDerived(
  snapshot: PersistedSnapshot,
  observed: SquadEconomy["observed"],
  currency: { name: string; rate: number }
): SquadEconomy["derived"] {
  const totalWage = sumMoney(snapshot.players.map((player) => player.wage), currency.name);
  const totalValue = sumMoney(snapshot.players.map((player) => player.value), currency.name);

  return {
    totalWage: {
      ...totalWage,
      isComplete: observed.coverage.playersWithWage === observed.coverage.playerCount
    },
    totalValue: {
      ...totalValue,
      isComplete: observed.coverage.playersWithValue === observed.coverage.playerCount
    },
    wageToValueRatio:
      totalValue.amount > 0
        ? roundRatio(totalWage.amount / totalValue.amount)
        : null,
    playerDetails: buildPlayerDetails(
      snapshot.players,
      totalWage.amount,
      totalValue.amount,
      currency.name
    ),
    concentration: {
      wage: buildConcentration(snapshot.players, "wage", totalWage.amount, currency.name),
      value: buildConcentration(
        snapshot.players,
        "value",
        totalValue.amount,
        currency.name
      )
    }
  };
}

function buildHistorical(
  snapshots: PersistedSnapshot[],
  effectiveCurrency: { name: string; rate: number },
  warnings: SquadEconomyWarning[]
): SquadEconomy["historical"] {
  const comparable = snapshots;
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
        { kind: "manual", label: "Moneda efectiva", value: effectiveCurrency?.name ?? null }
      ]
    });
  }

  const currentSummary = current ? buildHistoricalSnapshot(current, effectiveCurrency) : null;
  const previousSummary = previous ? buildHistoricalSnapshot(previous, effectiveCurrency) : null;

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
            totalValueDelta:
              currentSummary.totalValue.amount -
              previousSummary.totalValue.amount,
            totalValueDeltaPercent: percentDelta(
              previousSummary.totalValue.amount,
              currentSummary.totalValue.amount
            ),
            wageToValueRatioDelta:
              currentSummary.wageToValueRatio !== null && previousSummary.wageToValueRatio !== null
                ? roundRatio(currentSummary.wageToValueRatio - previousSummary.wageToValueRatio)
                : null
          }
        : {
            totalWageDelta: null,
            totalWageDeltaPercent: null,
            totalValueDelta: null,
            totalValueDeltaPercent: null,
            wageToValueRatioDelta: null
          }
  };
}

function buildWarnings(
  snapshot: PersistedSnapshot,
  observed: SquadEconomy["observed"],
  derived: SquadEconomy["derived"],
): SquadEconomyWarning[] {
  const warnings: SquadEconomyWarning[] = [];

  if (!derived.totalWage.isComplete || !derived.totalValue.isComplete) {
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
          value: observed.coverage.playersWithValue
        }
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
  const topValue = derived.concentration.value[0] ?? null;
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
          value: topWageDetail?.value.amount ?? null
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
          value: highestRelativeCost.value.amount
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
    historical.changes.totalValueDeltaPercent !== null &&
    historical.changes.totalWageDeltaPercent > 0.15 &&
    historical.changes.totalValueDeltaPercent < 0.05
  ) {
    findings.push({
      code: "wage_growth_without_asset_growth",
      severity: severityForDeterioration(
        historical.changes.totalWageDeltaPercent,
        historical.changes.totalValueDeltaPercent,
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
          value: roundPercent(historical.changes.totalValueDeltaPercent)
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
        { kind: "derived", label: "Valor estimado", value: derived.totalValue.amount }
      ]
    });
  }

  return findings;
}

function buildPlayerDetails(
  players: PersistedPlayerSnapshot[],
  totalWage: number,
  totalValue: number,
  currency: string
): SquadEconomyPlayerDetail[] {
  return players
    .map((player) => {
      const wageShare = totalWage > 0 ? roundRatio(player.wage / totalWage) : null;
      const valueShare =
        totalValue > 0
          ? roundRatio(player.value / totalValue)
          : null;
      const wageToValueRatio =
        player.value > 0
          ? roundRatio(player.wage / player.value)
          : null;

      return {
        playerId: player.playerId,
        snapshotPlayerId: player.id,
        name: player.name,
        age: player.age,
        wage: toMoney(player.wage, currency),
        value: toMoney(player.value, currency),
        wageShare,
        valueShare,
        wageToValueRatio,
        warnings: buildPlayerWarnings(player, wageShare, valueShare, wageToValueRatio)
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
  valueShare: number | null,
  wageToValueRatio: number | null
): SquadEconomyWarning[] {
  const warnings: SquadEconomyWarning[] = [];

  if (player.wage <= 0 || player.value <= 0) {
    warnings.push({
      code: "partial_player_detail",
      message: "El detalle del jugador tiene salario o valor estimado incompleto.",
      evidence: [
        { kind: "observed", label: "Salario", value: player.wage },
        { kind: "observed", label: "Valor estimado", value: player.value }
      ]
    });
  }

  if (
    wageShare !== null &&
    valueShare !== null &&
    wageToValueRatio !== null &&
    wageShare > valueShare * 2
  ) {
    warnings.push({
      code: "relative_cost_above_value_share",
      message: "La participacion salarial duplica la participacion de valor estimado.",
      evidence: [
        { kind: "derived", label: "Participacion salarial", value: roundPercent(wageShare) },
        {
          kind: "derived",
          label: "Participacion de valor",
          value: roundPercent(valueShare)
        },
        { kind: "derived", label: "Ratio salario/valor", value: wageToValueRatio }
      ]
    });
  }

  return warnings;
}

function buildHistoricalSnapshot(snapshot: PersistedSnapshot, currency: { name: string; rate: number }): SquadEconomyHistoricalSnapshot {
  const observed = buildObserved(snapshot, currency);
  const derived = buildDerived(snapshot, observed, currency);

  return {
    snapshotId: snapshot.id,
    snapshotDate: formatDate(snapshot.snapshotDate),
    totalWage: derived.totalWage,
    totalValue: derived.totalValue,
    wageToValueRatio: derived.wageToValueRatio
  };
}

function buildConcentration(
  players: PersistedPlayerSnapshot[],
  field: "wage" | "value",
  total: number,
  currency: string
): SquadEconomyConcentration[] {
  return players
    .map((player) => ({
      playerId: player.playerId,
      snapshotPlayerId: player.id,
      name: player.name,
      amount: player[field],
      currency,
      share: total > 0 ? roundRatio(player[field] / total) : null
    }))
    .sort((first, second) => second.amount - first.amount);
}

function sumMoney(values: number[], currency: string): Money {
  return {
    amount: values.reduce((total, money) => total + money, 0),
    currency
  };
}

function toMoney(amount: number, currency: string): Money {
  return { amount, currency };
}

function hasPositiveAmount(money: { amount: number }): boolean {
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

function severityForConcentration(share: number, riskTolerance: EconomyRiskTolerance): Severity {
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



export * from './types.js'
