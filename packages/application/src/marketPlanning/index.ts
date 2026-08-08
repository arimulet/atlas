import {
  MongoClubRepository,
  MongoSnapshotRepository,
  type PersistedPlayerSnapshot,
  type PersistedSnapshot
} from "@atlas/database";
import { buildClubOperatingSettings } from "../clubOperatingSettings/index.js";
import { getPlayerDevelopment } from "../playerDevelopment/index.js";
import { Severity, type PlayerDevelopmentPlayerSummary } from "../playerDevelopment/types.js";
import { getSquadEconomy } from "../economy/index.js";
import { SquadEconomyPlayerDetail } from "../economy/types.js";
import { GetSquadMarketPlanningInput, MarketPlanningCategory, MarketStrategy, SquadMarketObservedPlayer, SquadMarketPlanning, SquadMarketPlayerPlan, SquadMarketSignal, SquadMarketTiming, SquadMarketWarning } from "./types.js";
import { Confidence } from "../types.js";

const clubRepository = new MongoClubRepository();
const snapshotRepository = new MongoSnapshotRepository();

export const getSquadMarketPlanning = async (
  input: GetSquadMarketPlanningInput
): Promise<SquadMarketPlanning> => {
  const club = await clubRepository.findById(input.clubId);

  if (!club) {
    throw new Error(`Club not found: ${input.clubId}`);
  }

  const settings = buildClubOperatingSettings(club);
  const marketStrategy = settings.effective.preferences["market.strategy"] as MarketStrategy;
  const snapshots = await snapshotRepository.listByClub(input.clubId);
  const latest = snapshots.at(-1) ?? null;

  if (!latest) {
    return buildEmptyPlanning(input.clubId, marketStrategy);
  }

  const [economy, development] = await Promise.all([
    getSquadEconomy({ clubId: input.clubId }),
    getPlayerDevelopment({ clubId: input.clubId })
  ]);
  const economyBySnapshotPlayerId = new Map(
    economy.derived.playerDetails.map((player) => [player.snapshotPlayerId, player])
  );
  const developmentByIdentity = buildDevelopmentIndex(development.derived.players);
  const observedPlayers = latest.players.map(mapObservedPlayer);
  const players = latest.players
    .map((player) =>
      buildPlayerPlan({
        player,
        snapshots,
        marketStrategy,
        economyDetail: economyBySnapshotPlayerId.get(player.id) ?? null,
        developmentSummary: findDevelopmentSummary(player, developmentByIdentity)
      })
    )
    .sort(comparePlayerPlans);

  return {
    clubId: input.clubId,
    snapshotId: latest.id,
    snapshotDate: formatDate(latest.snapshotDate),
    observed: {
      players: observedPlayers,
      coverage: {
        playerCount: latest.players.length,
        playersWithWage: latest.players.filter((player) => player.wage.amount > 0).length,
        playersWithEstimatedValue: latest.players.filter(
          (player) => player.estimatedValue.amount > 0
        ).length,
        playersWithStableIdentity: latest.players.filter((player) => Boolean(player.externalId))
          .length
      }
    },
    manual: { marketStrategy },
    derived: {
      categoryCounts: countCategories(players),
      players
    },
    warnings: buildGlobalWarnings(latest, snapshots)
  };
}

function buildEmptyPlanning(
  clubId: string,
  marketStrategy: MarketStrategy
): SquadMarketPlanning {
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
        playersWithStableIdentity: 0
      }
    },
    manual: { marketStrategy },
    derived: {
      categoryCounts: {
        sale_candidate: 0,
        protection_candidate: 0,
        follow_up: 0,
        insufficient_signal: 0
      },
      players: []
    },
    warnings: [
      {
        code: "no_snapshots",
        message: "La planificacion interna de mercado necesita un snapshot de plantilla.",
        evidence: [{ kind: "observed", label: "Snapshots disponibles", value: 0 }]
      }
    ]
  };
}

function buildPlayerPlan(input: {
  player: PersistedPlayerSnapshot;
  snapshots: PersistedSnapshot[];
  marketStrategy: MarketStrategy;
  economyDetail: SquadEconomyPlayerDetail | null;
  developmentSummary: PlayerDevelopmentPlayerSummary | null;
}): SquadMarketPlayerPlan {
  const historicalTrend = buildPlayerHistoricalTrend(input.player, input.snapshots);
  const warnings = buildPlayerWarnings(
    input.player,
    input.snapshots,
    input.economyDetail,
    historicalTrend
  );
  const signals = buildSignals({ ...input, historicalTrend });
  const category = chooseCategory(signals, warnings);
  const strongestSignal = signals[0] ?? null;

  return {
    playerId: input.player.playerId,
    snapshotPlayerId: input.player.id,
    name: input.player.name,
    age: input.player.age,
    role: resolveRole(input.player),
    category,
    severity: strongestSignal?.severity ?? "info",
    confidence: calculateConfidence(signals, warnings, historicalTrend),
    rationale: buildRationale(category),
    timing: buildTiming(category, signals, warnings, historicalTrend),
    signals:
      signals.length > 0
        ? signals
        : [
            {
              code: "insufficient_market_signal",
              severity: "info",
              confidence: "low",
              message: "No hay evidencia suficiente para una senal prudente de mercado interno.",
              evidence: [
                { kind: "observed", label: "Jugador", value: input.player.name },
                { kind: "manual", label: "market.strategy", value: input.marketStrategy }
              ]
            }
          ],
    warnings
  };
}

function buildSignals(input: {
  player: PersistedPlayerSnapshot;
  marketStrategy: MarketStrategy;
  economyDetail: SquadEconomyPlayerDetail | null;
  developmentSummary: PlayerDevelopmentPlayerSummary | null;
  historicalTrend: PlayerHistoricalTrend;
}): SquadMarketSignal[] {
  const signals: SquadMarketSignal[] = [];
  const wageToValueRatio = input.economyDetail?.wageToValueRatio ?? null;
  const developmentFinding = input.developmentSummary?.findings[0] ?? null;
  const improvedSkills = input.developmentSummary?.recentEvolution.improvedSkills ?? 0;
  const declinedSkills = input.developmentSummary?.recentEvolution.declinedSkills ?? 0;
  const comparableSkills = input.developmentSummary?.recentEvolution.comparableSkills ?? 0;

  if (
    input.player.age >= 30 &&
    input.player.estimatedValue.amount > 0 &&
    input.historicalTrend.valueDeltaPercent !== null &&
    input.historicalTrend.valueDeltaPercent <= -0.08
  ) {
    signals.push({
      code: "senior_declining_value_timing",
      severity: input.player.age >= 32 || input.historicalTrend.valueDeltaPercent <= -0.18 ? "high" : "medium",
      confidence: input.historicalTrend.snapshotCount >= 3 ? "high" : "medium",
      message:
        "Jugador veterano con valor estimado en baja dentro del historial propio; senal de timing patrimonial para revisar salida posible sin estimar precio real.",
      evidence: [
        { kind: "observed", label: "Edad", value: input.player.age },
        { kind: "observed", label: "Ventana desde", value: input.historicalTrend.from ?? undefined },
        { kind: "observed", label: "Ventana hasta", value: input.historicalTrend.to ?? undefined },
        { kind: "derived", label: "Variacion valor %", value: input.historicalTrend.valueDeltaPercent ?? undefined },
        { kind: "manual", label: "market.strategy", value: input.marketStrategy }
      ]
    });
  } else if (input.player.age >= 30 && input.player.estimatedValue.amount > 0) {
    signals.push({
      code: "senior_asset_review",
      severity: input.player.age >= 32 ? "high" : "medium",
      confidence: "medium",
      message:
        "Jugador veterano con valor estimado observado; conviene revisar timing patrimonial sin asumir precio real de venta.",
      evidence: [
        { kind: "observed", label: "Edad", value: input.player.age },
        { kind: "observed", label: "Valor estimado", value: input.player.estimatedValue.amount },
        { kind: "manual", label: "market.strategy", value: input.marketStrategy }
      ]
    });
  }

  if (wageToValueRatio !== null && wageToValueRatio >= wageToValueLimit(input.marketStrategy)) {
    signals.push({
      code: "high_internal_cost",
      severity: wageToValueRatio >= wageToValueLimit(input.marketStrategy) * 1.5 ? "high" : "medium",
      confidence: "medium",
      message:
        "El costo salarial relativo es alto frente al valor estimado interno; es senal de revision, no orden de venta.",
      evidence: [
        { kind: "observed", label: "Salario", value: input.player.wage.amount },
        { kind: "observed", label: "Valor estimado", value: input.player.estimatedValue.amount },
        { kind: "derived", label: "Ratio salario/valor", value: wageToValueRatio },
        { kind: "manual", label: "market.strategy", value: input.marketStrategy }
      ]
    });
  }

  if (
    input.historicalTrend.wageDeltaPercent !== null &&
    input.historicalTrend.wageDeltaPercent >= 0.12 &&
    (input.historicalTrend.valueDeltaPercent === null || input.historicalTrend.valueDeltaPercent < 0.06)
  ) {
    signals.push({
      code: "wage_growth_without_value_support",
      severity: input.historicalTrend.wageDeltaPercent >= 0.25 ? "high" : "medium",
      confidence: input.historicalTrend.snapshotCount >= 3 ? "high" : "medium",
      message:
        "El salario crece sin respaldo proporcional del valor estimado propio; conviene revisar el timing salarial del activo.",
      evidence: [
        { kind: "derived", label: "Variacion salario %", value: input.historicalTrend.wageDeltaPercent ?? undefined },
        { kind: "derived", label: "Variacion valor %", value: input.historicalTrend.valueDeltaPercent ?? undefined },
        { kind: "observed", label: "Snapshots comparables", value: input.historicalTrend.snapshotCount }
      ]
    });
  }

  if (developmentFinding?.type === "decline") {
    signals.push({
      code: "development_decline_review",
      severity: developmentFinding.severity === "high" ? "high" : "medium",
      confidence: developmentFinding.confidence,
      message:
        "El modulo de desarrollo detecta deterioro observado; puede justificar seguimiento de timing interno.",
      evidence: [
        { kind: "inferred", label: "Hallazgo desarrollo", value: developmentFinding.title },
        { kind: "derived", label: "Habilidades que bajaron", value: declinedSkills },
        { kind: "inferred", label: "Causalidad de entrenamiento", value: "No atribuida" }
      ]
    });
  }

  if (
    input.player.age <= 23 &&
    input.player.estimatedValue.amount > 0 &&
    improvedSkills > declinedSkills &&
    (input.historicalTrend.valueDeltaPercent === null || input.historicalTrend.valueDeltaPercent >= -0.05)
  ) {
    signals.push({
      code: "young_asset_protection",
      severity: "medium",
      confidence: input.developmentSummary?.recentEvolution.confidence ?? "medium",
      message:
        "Jugador joven con mejora observada y valor estimado positivo; senal interna para proteger el activo.",
      evidence: [
        { kind: "observed", label: "Edad", value: input.player.age },
        { kind: "observed", label: "Valor estimado", value: input.player.estimatedValue.amount },
        { kind: "derived", label: "Habilidades que subieron", value: improvedSkills },
        { kind: "manual", label: "market.strategy", value: input.marketStrategy }
      ]
    });
  }

  if (
    input.player.age <= 24 &&
    improvedSkills > declinedSkills &&
    input.historicalTrend.valueDeltaPercent !== null &&
    input.historicalTrend.valueDeltaPercent >= 0.08
  ) {
    signals.push({
      code: "young_growth_hold_timing",
      severity: "medium",
      confidence: input.developmentSummary?.recentEvolution.confidence ?? "medium",
      message:
        "Jugador joven con mejora de habilidades y valorizacion interna; la senal favorece proteger o posponer decisiones fuertes.",
      evidence: [
        { kind: "derived", label: "Habilidades que subieron", value: improvedSkills },
        { kind: "derived", label: "Variacion valor %", value: input.historicalTrend.valueDeltaPercent ?? undefined },
        { kind: "observed", label: "Ventana hasta", value: input.historicalTrend.to ?? undefined }
      ]
    });
  }

  if (input.player.age <= 21 && comparableSkills === 0) {
    signals.push({
      code: "young_player_follow_up",
      severity: "low",
      confidence: "low",
      message:
        "Jugador joven sin historial comparable suficiente; corresponde seguimiento antes de clasificar con fuerza.",
      evidence: [
        { kind: "observed", label: "Edad", value: input.player.age },
        { kind: "derived", label: "Habilidades comparables", value: comparableSkills }
      ]
    });
  }

  return signals.sort(compareSignals);
}

function chooseCategory(
  signals: SquadMarketSignal[],
  warnings: SquadMarketWarning[]
): MarketPlanningCategory {
  if (warnings.some((warning) => warning.code === "missing_market_core_data")) {
    return "insufficient_signal";
  }

  if (signals.some((signal) => signal.code === "young_asset_protection")) {
    return "protection_candidate";
  }

  if (signals.some((signal) => signal.code === "young_growth_hold_timing")) {
    return "protection_candidate";
  }

  if (
    signals.some((signal) =>
      [
        "senior_asset_review",
        "senior_declining_value_timing",
        "high_internal_cost",
        "wage_growth_without_value_support",
        "development_decline_review"
      ].includes(
        signal.code
      )
    )
  ) {
    return "sale_candidate";
  }

  if (signals.some((signal) => signal.code === "young_player_follow_up")) {
    return "follow_up";
  }

  return "insufficient_signal";
}

function buildPlayerWarnings(
  player: PersistedPlayerSnapshot,
  snapshots: PersistedSnapshot[],
  economyDetail: SquadEconomyPlayerDetail | null,
  historicalTrend: PlayerHistoricalTrend
): SquadMarketWarning[] {
  const warnings: SquadMarketWarning[] = [];

  if (player.wage.amount <= 0 || player.estimatedValue.amount <= 0) {
    warnings.push({
      code: "missing_market_core_data",
      message: "Falta salario o valor estimado positivo para clasificar con prudencia.",
      evidence: [
        { kind: "observed", label: "Salario", value: player.wage.amount },
        { kind: "observed", label: "Valor estimado", value: player.estimatedValue.amount }
      ]
    });
  }

  if (!player.externalId) {
    warnings.push({
      code: "ambiguous_identity",
      message: "Falta identidad stable; el historial del jugador puede no ser comparable.",
      evidence: [{ kind: "observed", label: "External id", value: player.externalId ?? undefined }]
    });
  }

  if (snapshots.length < 2) {
    warnings.push({
      code: "short_history",
      message: "Historial corto; la lectura usa principalmente el snapshot actual.",
      evidence: [{ kind: "observed", label: "Snapshots disponibles", value: snapshots.length }]
    });
  }

  if (historicalTrend.snapshotCount < 2) {
    warnings.push({
      code: "short_player_history",
      message: "El jugador no tiene dos snapshots comparables por identidad estable.",
      evidence: [
        { kind: "observed", label: "Snapshots comparables del jugador", value: historicalTrend.snapshotCount }
      ]
    });
  }

  if (
    historicalTrend.valueDeltaPercent !== null &&
    historicalTrend.valueDeltaPercent <= -0.08 &&
    historicalTrend.improvedSkills > historicalTrend.declinedSkills
  ) {
    warnings.push({
      code: "contradictory_market_signals",
      message:
        "El valor estimado baja mientras las habilidades mejoran; la conclusion debe mantenerse prudente.",
      evidence: [
        { kind: "derived", label: "Variacion valor %", value: historicalTrend.valueDeltaPercent },
        { kind: "derived", label: "Habilidades que subieron", value: historicalTrend.improvedSkills }
      ]
    });
  }

  if (economyDetail?.warnings.length) {
    warnings.push({
      code: "limited_economy_comparability",
      message: "Economia de plantilla reporta advertencias para este jugador.",
      evidence: [
        {
          kind: "derived",
          label: "Advertencias economia",
          value: economyDetail.warnings.map((warning) => warning.code).join(", ")
        }
      ]
    });
  }

  return warnings;
}

function buildGlobalWarnings(
  latest: PersistedSnapshot,
  snapshots: PersistedSnapshot[]
): SquadMarketWarning[] {
  const warnings: SquadMarketWarning[] = [];

  if (snapshots.length < 2) {
    warnings.push({
      code: "short_history",
      message:
        "La planificacion de mercado interno mejora con al menos dos snapshots comparables.",
      evidence: [{ kind: "observed", label: "Snapshots disponibles", value: snapshots.length }]
    });
  }

  if (latest.players.some((player) => player.wage.amount <= 0 || player.estimatedValue.amount <= 0)) {
    warnings.push({
      code: "partial_market_data",
      message: "Hay jugadores con salario o valor estimado faltante; algunas categorias quedan debiles.",
      evidence: [
        { kind: "observed", label: "Jugadores", value: latest.players.length },
        {
          kind: "observed",
          label: "Datos completos",
          value: latest.players.filter(
            (player) => player.wage.amount > 0 && player.estimatedValue.amount > 0
          ).length
        }
      ]
    });
  }

  return warnings;
}

function calculateConfidence(
  signals: SquadMarketSignal[],
  warnings: SquadMarketWarning[],
  historicalTrend: PlayerHistoricalTrend
): Confidence {
  if (
    signals.length === 0 ||
    warnings.some((warning) =>
      [
        "missing_market_core_data",
        "ambiguous_identity",
        "short_player_history",
        "contradictory_market_signals"
      ].includes(warning.code)
    )
  ) {
    return "low";
  }

  if (
    historicalTrend.snapshotCount >= 3 &&
    warnings.length === 0 &&
    signals.some((signal) => signal.confidence === "high")
  ) {
    return "high";
  }

  return "medium";
}

interface PlayerHistoricalTrend {
  from?: string | null;
  to?: string | null;
  snapshotCount: number;
  valueDeltaPercent: number | null;
  wageDeltaPercent: number | null;
  improvedSkills: number;
  declinedSkills: number;
}

function buildPlayerHistoricalTrend(
  player: PersistedPlayerSnapshot,
  snapshots: PersistedSnapshot[]
): PlayerHistoricalTrend {
  const playerSnapshots = snapshots
    .map((snapshot) => ({
      snapshotDate: snapshot.snapshotDate,
      player: findSamePlayerSnapshot(player, snapshot)
    }))
    .filter((entry): entry is { snapshotDate: Date; player: PersistedPlayerSnapshot } =>
      Boolean(entry.player)
    );
  const first = playerSnapshots[0] ?? null;
  const latest = playerSnapshots.at(-1) ?? null;

  if (!first || !latest || playerSnapshots.length < 2) {
    return {
      from: first ? formatDate(first.snapshotDate) : null,
      to: latest ? formatDate(latest.snapshotDate) : null,
      snapshotCount: playerSnapshots.length,
      valueDeltaPercent: null,
      wageDeltaPercent: null,
      improvedSkills: 0,
      declinedSkills: 0
    };
  }

  return {
    from: formatDate(first.snapshotDate),
    to: formatDate(latest.snapshotDate),
    snapshotCount: playerSnapshots.length,
    valueDeltaPercent: calculatePercentDelta(
      first.player.estimatedValue.amount,
      latest.player.estimatedValue.amount
    ),
    wageDeltaPercent: calculatePercentDelta(first.player.wage.amount, latest.player.wage.amount),
    ...calculateSkillDirection(first.player, latest.player)
  };
}

function findSamePlayerSnapshot(
  target: PersistedPlayerSnapshot,
  snapshot: PersistedSnapshot
): PersistedPlayerSnapshot | null {
  if (target.externalId) {
    return snapshot.players.find((player) => player.externalId === target.externalId) ?? null;
  }

  if (target.playerId) {
    return snapshot.players.find((player) => player.playerId === target.playerId) ?? null;
  }

  return null;
}

function calculatePercentDelta(previous: number, current: number): number | null {
  if (previous <= 0) {
    return null;
  }

  return Number(((current - previous) / previous).toFixed(4));
}

function calculateSkillDirection(
  previous: PersistedPlayerSnapshot,
  current: PersistedPlayerSnapshot
): Pick<PlayerHistoricalTrend, "improvedSkills" | "declinedSkills"> {
  let improvedSkills = 0;
  let declinedSkills = 0;
  const skillKeys = Object.keys(current.skills) as Array<keyof PersistedPlayerSnapshot["skills"]>;

  for (const skill of skillKeys) {
    const previousValue = previous.skills[skill];
    const currentValue = current.skills[skill];

    if (previousValue === null || currentValue === null) {
      continue;
    }

    if (currentValue > previousValue) improvedSkills += 1;
    if (currentValue < previousValue) declinedSkills += 1;
  }

  return { improvedSkills, declinedSkills };
}

function buildTiming(
  category: MarketPlanningCategory,
  signals: SquadMarketSignal[],
  warnings: SquadMarketWarning[],
  historicalTrend: PlayerHistoricalTrend
): SquadMarketTiming {
  return {
    label: labelTiming(category, warnings),
    window: {
      from: historicalTrend.from ?? null,
      to: historicalTrend.to ?? null,
      snapshotCount: historicalTrend.snapshotCount
    },
    dataUsed: buildTimingDataUsed(signals, historicalTrend),
    mainReasons: signals.slice(0, 3).map((signal) => signal.message),
    limits: warnings.map((warning) => warning.message)
  };
}

function labelTiming(
  category: MarketPlanningCategory,
  warnings: SquadMarketWarning[]
): string {
  if (warnings.some((warning) => warning.code === "contradictory_market_signals")) {
    return "Timing contradictorio";
  }

  if (category === "sale_candidate") return "Revision cercana";
  if (category === "protection_candidate") return "Proteger y monitorear";
  if (category === "follow_up") return "Esperar mas evidencia";
  return "Sin timing fuerte";
}

function buildTimingDataUsed(
  signals: SquadMarketSignal[],
  historicalTrend: PlayerHistoricalTrend
): string[] {
  const labels = new Set(
    signals.flatMap((signal) => signal.evidence.map((evidence) => evidence.label))
  );

  if (historicalTrend.snapshotCount > 0) labels.add("Historial propio");

  return Array.from(labels);
}

function countCategories(
  players: SquadMarketPlayerPlan[]
): Record<MarketPlanningCategory, number> {
  return {
    sale_candidate: players.filter((player) => player.category === "sale_candidate").length,
    protection_candidate: players.filter((player) => player.category === "protection_candidate")
      .length,
    follow_up: players.filter((player) => player.category === "follow_up").length,
    insufficient_signal: players.filter((player) => player.category === "insufficient_signal")
      .length
  };
}

function buildDevelopmentIndex(
  players: PlayerDevelopmentPlayerSummary[]
): Map<string, PlayerDevelopmentPlayerSummary> {
  const index = new Map<string, PlayerDevelopmentPlayerSummary>();

  for (const player of players) {
    if (player.externalId) {
      index.set(`external:${player.externalId}`, player);
    }

    if (player.playerId) {
      index.set(`player:${player.playerId}`, player);
    }
  }

  return index;
}

function findDevelopmentSummary(
  player: PersistedPlayerSnapshot,
  index: Map<string, PlayerDevelopmentPlayerSummary>
): PlayerDevelopmentPlayerSummary | null {
  if (player.externalId) {
    return index.get(`external:${player.externalId}`) ?? null;
  }

  if (player.playerId) {
    return index.get(`player:${player.playerId}`) ?? null;
  }

  return null;
}

function mapObservedPlayer(player: PersistedPlayerSnapshot): SquadMarketObservedPlayer {
  return {
    playerId: player.playerId,
    externalId: player.externalId,
    snapshotPlayerId: player.id,
    name: player.name,
    age: player.age,
    role: resolveRole(player),
    wage: player.wage,
    estimatedValue: player.estimatedValue
  };
}

function resolveRole(player: PersistedPlayerSnapshot): SquadMarketObservedPlayer["role"] {
  if (player.observedPosition) {
    return { label: player.observedPosition, source: "observed" };
  }

  if (player.roles[0]) {
    return { label: player.roles[0], source: "inferred" };
  }

  return { label: "Undefined", source: "unknown" };
}

function wageToValueLimit(marketStrategy: MarketStrategy): number {
  if (marketStrategy === "conservative") return 0.04;
  if (marketStrategy === "opportunistic") return 0.07;
  return 0.055;
}

function compareSignals(left: SquadMarketSignal, right: SquadMarketSignal): number {
  return severityPriority(right.severity) - severityPriority(left.severity);
}

function comparePlayerPlans(left: SquadMarketPlayerPlan, right: SquadMarketPlayerPlan): number {
  return (
    categoryPriority(right.category) - categoryPriority(left.category) ||
    severityPriority(right.severity) - severityPriority(left.severity) ||
    left.name.localeCompare(right.name)
  );
}

function categoryPriority(category: MarketPlanningCategory): number {
  if (category === "sale_candidate") return 4;
  if (category === "protection_candidate") return 3;
  if (category === "follow_up") return 2;
  return 1;
}

function severityPriority(severity: Severity): number {
  if (severity === "high") return 4;
  if (severity === "medium") return 3;
  if (severity === "low") return 2;
  return 1;
}

function buildRationale(category: MarketPlanningCategory): string {
  if (category === "sale_candidate") {
    return "Senal prudente para revisar posible salida interna; no es una orden ni estima precio real.";
  }

  if (category === "protection_candidate") {
    return "Senal prudente para proteger el activo dentro de la planificacion del club.";
  }

  if (category === "follow_up") {
    return "Requiere seguimiento antes de convertir la senal en una decision de plantilla.";
  }

  return "Sin evidencia suficiente para clasificar con fuerza.";
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
