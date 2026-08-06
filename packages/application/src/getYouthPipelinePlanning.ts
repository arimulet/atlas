import {
  MongoClubRepository,
  MongoSnapshotRepository,
  type PersistedPlayerSnapshot,
  type PersistedSnapshot,
  type SnapshotSkillSet
} from "@atlas/database";
import { buildClubOperatingSettings } from "./clubOperatingSettings.js";
import { getPlayerDevelopment, type PlayerDevelopmentPlayerSummary } from "./getPlayerDevelopment.js";
import { getSquadMarketPlanning, type SquadMarketPlayerPlan } from "./getSquadMarketPlanning.js";

type EvidenceKind = "observed" | "manual" | "derived" | "inferred";
export type YouthPipelineCategory =
  | "standout_prospect"
  | "follow_up"
  | "stagnation_risk"
  | "insufficient_data";
export type YouthPipelineSeverity = "info" | "low" | "medium" | "high";
export type YouthPipelineConfidence = "low" | "medium" | "high";
type SkillKey = keyof SnapshotSkillSet;

export interface GetYouthPipelinePlanningInput {
  clubId: string;
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
  estimatedValue: { amount: number; currency: string | null };
  skills: SnapshotSkillSet;
}

export interface YouthPipelinePlayerPlan {
  playerId: string | null;
  snapshotPlayerId: string;
  name: string;
  age: number;
  role: {
    label: string;
    source: "observed" | "inferred" | "unknown";
  };
  category: YouthPipelineCategory;
  severity: YouthPipelineSeverity;
  confidence: YouthPipelineConfidence;
  rationale: string;
  signals: YouthPipelineSignal[];
  warnings: YouthPipelineWarning[];
}

export interface YouthPipelineSignal {
  code: string;
  severity: YouthPipelineSeverity;
  confidence: YouthPipelineConfidence;
  message: string;
  evidence: YouthPipelineEvidence[];
}

export interface YouthPipelineWarning {
  code: string;
  message: string;
  evidence: YouthPipelineEvidence[];
}

export interface YouthPipelineEvidence {
  kind: EvidenceKind;
  label: string;
  value: string | number | null;
}

export const YOUTH_PIPELINE_AGE_THRESHOLD = 23;

const skillKeys = [
  "stamina",
  "pace",
  "technique",
  "passing",
  "keeper",
  "defender",
  "playmaker",
  "striker"
] as const satisfies readonly SkillKey[];

const clubRepository = new MongoClubRepository();
const snapshotRepository = new MongoSnapshotRepository();

export async function getYouthPipelinePlanning(
  input: GetYouthPipelinePlanningInput
): Promise<YouthPipelinePlanning> {
  const club = await clubRepository.findById(input.clubId);

  if (!club) {
    throw new Error(`Club not found: ${input.clubId}`);
  }

  const academyInvestment =
    buildClubOperatingSettings(club).effective.preferences["academy.investment"];
  const snapshots = await snapshotRepository.listByClub(input.clubId);
  const latest = snapshots.at(-1) ?? null;

  if (!latest) {
    return buildEmptyPlanning(input.clubId, academyInvestment);
  }

  const [development, marketPlanning] = await Promise.all([
    getPlayerDevelopment({ clubId: input.clubId }),
    getSquadMarketPlanning({ clubId: input.clubId })
  ]);
  const developmentIndex = buildDevelopmentIndex(development.derived.players);
  const marketIndex = buildMarketIndex(marketPlanning.derived.players);
  const youngPlayers = latest.players.filter((player) => player.age <= YOUTH_PIPELINE_AGE_THRESHOLD);
  const plans = youngPlayers
    .map((player) =>
      buildPlayerPlan({
        player,
        snapshots,
        academyInvestment,
        developmentSummary: findDevelopmentSummary(player, developmentIndex),
        marketPlan: marketIndex.get(player.id) ?? null
      })
    )
    .sort(comparePlayerPlans);

  return {
    clubId: input.clubId,
    snapshotId: latest.id,
    snapshotDate: formatDate(latest.snapshotDate),
    observed: {
      youthAgeThreshold: YOUTH_PIPELINE_AGE_THRESHOLD,
      players: youngPlayers.map(mapObservedPlayer),
      coverage: {
        seniorPlayerCount: latest.players.length,
        youngSeniorPlayerCount: youngPlayers.length,
        playersWithStableIdentity: youngPlayers.filter((player) => Boolean(player.externalId))
          .length,
        playersWithCompleteSkills: youngPlayers.filter(hasCompleteSkills).length
      }
    },
    manual: { academyInvestment },
    derived: {
      categoryCounts: countCategories(plans),
      players: plans
    },
    warnings: buildGlobalWarnings(latest, snapshots, youngPlayers)
  };
}

function buildEmptyPlanning(clubId: string, academyInvestment: string): YouthPipelinePlanning {
  return {
    clubId,
    snapshotId: null,
    snapshotDate: null,
    observed: {
      youthAgeThreshold: YOUTH_PIPELINE_AGE_THRESHOLD,
      players: [],
      coverage: {
        seniorPlayerCount: 0,
        youngSeniorPlayerCount: 0,
        playersWithStableIdentity: 0,
        playersWithCompleteSkills: 0
      }
    },
    manual: { academyInvestment },
    derived: {
      categoryCounts: {
        standout_prospect: 0,
        follow_up: 0,
        stagnation_risk: 0,
        insufficient_data: 0
      },
      players: []
    },
    warnings: [
      {
        code: "no_snapshots",
        message: "El pipeline juvenil senior necesita un snapshot de plantilla.",
        evidence: [{ kind: "observed", label: "Snapshots disponibles", value: 0 }]
      }
    ]
  };
}

function buildPlayerPlan(input: {
  player: PersistedPlayerSnapshot;
  snapshots: PersistedSnapshot[];
  academyInvestment: string;
  developmentSummary: PlayerDevelopmentPlayerSummary | null;
  marketPlan: SquadMarketPlayerPlan | null;
}): YouthPipelinePlayerPlan {
  const warnings = buildPlayerWarnings(input.player, input.snapshots, input.developmentSummary);
  const signals = buildSignals(input);
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
    confidence: calculateConfidence(signals, warnings),
    rationale: buildRationale(category),
    signals: signals.length > 0 ? signals : [buildInsufficientSignal(input.player)],
    warnings
  };
}

function buildSignals(input: {
  player: PersistedPlayerSnapshot;
  academyInvestment: string;
  developmentSummary: PlayerDevelopmentPlayerSummary | null;
  marketPlan: SquadMarketPlayerPlan | null;
}): YouthPipelineSignal[] {
  const signals: YouthPipelineSignal[] = [];
  const development = input.developmentSummary;
  const improvedSkills = development?.recentEvolution.improvedSkills ?? 0;
  const declinedSkills = development?.recentEvolution.declinedSkills ?? 0;
  const comparableSkills = development?.recentEvolution.comparableSkills ?? 0;
  const relevantSkillAverage = averageSkills(development?.relevantSkills ?? []);

  if (
    input.player.age <= 21 &&
    relevantSkillAverage !== null &&
    relevantSkillAverage >= 9 &&
    improvedSkills > declinedSkills
  ) {
    signals.push({
      code: "standout_young_growth",
      severity: "medium",
      confidence: development?.recentEvolution.confidence ?? "medium",
      message:
        "Jugador joven del plantel senior con habilidades relevantes altas y mejora observada.",
      evidence: [
        { kind: "observed", label: "Edad", value: input.player.age },
        { kind: "derived", label: "Promedio skills relevantes", value: relevantSkillAverage },
        { kind: "derived", label: "Habilidades que subieron", value: improvedSkills },
        { kind: "manual", label: "academy.investment", value: input.academyInvestment }
      ]
    });
  }

  if (input.marketPlan?.category === "protection_candidate") {
    signals.push({
      code: "market_protection_context",
      severity: "medium",
      confidence: input.marketPlan.confidence,
      message:
        "La planificacion interna de mercado tambien marca al jugador como activo a proteger.",
      evidence: [
        { kind: "inferred", label: "Senal mercado interno", value: input.marketPlan.category },
        { kind: "inferred", label: "Timing mercado", value: input.marketPlan.timing.label }
      ]
    });
  }

  if (development?.findings.some((finding) => finding.type === "stagnation")) {
    signals.push({
      code: "young_stagnation_risk",
      severity: input.player.age >= 22 ? "medium" : "low",
      confidence: development.recentEvolution.confidence,
      message:
        "El modulo de desarrollo muestra estancamiento observado; requiere revisar prioridad de seguimiento.",
      evidence: [
        { kind: "observed", label: "Edad", value: input.player.age },
        { kind: "derived", label: "Habilidades comparables", value: comparableSkills },
        { kind: "inferred", label: "Hallazgo desarrollo", value: "stagnation" }
      ]
    });
  }

  if (declinedSkills > improvedSkills) {
    signals.push({
      code: "young_decline_review",
      severity: "medium",
      confidence: development?.recentEvolution.confidence ?? "low",
      message: "Hay mas habilidades visibles en baja que en mejora para un jugador joven.",
      evidence: [
        { kind: "derived", label: "Habilidades que bajaron", value: declinedSkills },
        { kind: "derived", label: "Habilidades que subieron", value: improvedSkills }
      ]
    });
  }

  if (input.player.age <= YOUTH_PIPELINE_AGE_THRESHOLD && comparableSkills === 0) {
    signals.push({
      code: "young_senior_follow_up",
      severity: "low",
      confidence: "low",
      message:
        "Jugador joven del plantel senior sin historial comparable suficiente; corresponde seguimiento prudente.",
      evidence: [
        { kind: "observed", label: "Edad", value: input.player.age },
        { kind: "derived", label: "Habilidades comparables", value: comparableSkills },
        { kind: "manual", label: "academy.investment", value: input.academyInvestment }
      ]
    });
  }

  return signals.sort(compareSignals);
}

function chooseCategory(
  signals: YouthPipelineSignal[],
  warnings: YouthPipelineWarning[]
): YouthPipelineCategory {
  if (
    warnings.some((warning) =>
      ["missing_skills", "ambiguous_identity", "short_player_history"].includes(warning.code)
    ) &&
    !signals.some((signal) => signal.code === "young_stagnation_risk")
  ) {
    return "insufficient_data";
  }

  if (
    signals.some((signal) =>
      ["standout_young_growth", "market_protection_context"].includes(signal.code)
    )
  ) {
    return "standout_prospect";
  }

  if (
    signals.some((signal) => ["young_stagnation_risk", "young_decline_review"].includes(signal.code))
  ) {
    return "stagnation_risk";
  }

  if (signals.some((signal) => signal.code === "young_senior_follow_up")) {
    return "follow_up";
  }

  return "insufficient_data";
}

function buildPlayerWarnings(
  player: PersistedPlayerSnapshot,
  snapshots: PersistedSnapshot[],
  developmentSummary: PlayerDevelopmentPlayerSummary | null
): YouthPipelineWarning[] {
  const warnings: YouthPipelineWarning[] = [];
  const missingSkills = skillKeys.filter((skill) => player.skills[skill] === null);

  if (!player.externalId) {
    warnings.push({
      code: "ambiguous_identity",
      message: "Falta identidad estable; el historial del joven puede no ser comparable.",
      evidence: [{ kind: "observed", label: "External id", value: player.externalId }]
    });
  }

  if (snapshots.length < 2) {
    warnings.push({
      code: "short_history",
      message: "Historial corto; la lectura no debe convertirse en conclusion fuerte.",
      evidence: [{ kind: "observed", label: "Snapshots disponibles", value: snapshots.length }]
    });
  }

  if (!developmentSummary || developmentSummary.recentEvolution.comparableSkills === 0) {
    warnings.push({
      code: "short_player_history",
      message: "El jugador no tiene dos puntos comparables de desarrollo.",
      evidence: [{ kind: "derived", label: "Habilidades comparables", value: 0 }]
    });
  }

  if (missingSkills.length > 0) {
    warnings.push({
      code: "missing_skills",
      message: "Faltan habilidades visibles; la clasificacion queda limitada.",
      evidence: [{ kind: "observed", label: "Habilidades faltantes", value: missingSkills.join(", ") }]
    });
  }

  return warnings;
}

function buildGlobalWarnings(
  latest: PersistedSnapshot,
  snapshots: PersistedSnapshot[],
  youngPlayers: PersistedPlayerSnapshot[]
): YouthPipelineWarning[] {
  const warnings: YouthPipelineWarning[] = [
    {
      code: "senior_youth_scope",
      message:
        "Esta vista analiza jovenes del plantel senior; no representa escuela juvenil real de Sokker.",
      evidence: [
        { kind: "observed", label: "Jugadores senior", value: latest.players.length },
        { kind: "derived", label: "Umbral joven", value: YOUTH_PIPELINE_AGE_THRESHOLD }
      ]
    }
  ];

  if (youngPlayers.length === 0) {
    warnings.push({
      code: "no_young_senior_players",
      message: "No hay jugadores del plantel senior dentro del umbral juvenil definido.",
      evidence: [{ kind: "derived", label: "Jovenes senior", value: 0 }]
    });
  }

  if (snapshots.length < 2) {
    warnings.push({
      code: "short_history",
      message: "La lectura de pipeline juvenil senior mejora con al menos dos snapshots.",
      evidence: [{ kind: "observed", label: "Snapshots disponibles", value: snapshots.length }]
    });
  }

  return warnings;
}

function buildInsufficientSignal(player: PersistedPlayerSnapshot): YouthPipelineSignal {
  return {
    code: "insufficient_youth_signal",
    severity: "info",
    confidence: "low",
    message: "No hay evidencia suficiente para clasificar con fuerza al joven senior.",
    evidence: [{ kind: "observed", label: "Jugador", value: player.name }]
  };
}

function calculateConfidence(
  signals: YouthPipelineSignal[],
  warnings: YouthPipelineWarning[]
): YouthPipelineConfidence {
  if (
    signals.length === 0 ||
    warnings.some((warning) =>
      ["missing_skills", "ambiguous_identity", "short_player_history"].includes(warning.code)
    )
  ) {
    return "low";
  }

  if (signals.some((signal) => signal.confidence === "high") && warnings.length === 0) {
    return "high";
  }

  return "medium";
}

function countCategories(
  players: YouthPipelinePlayerPlan[]
): Record<YouthPipelineCategory, number> {
  return {
    standout_prospect: players.filter((player) => player.category === "standout_prospect").length,
    follow_up: players.filter((player) => player.category === "follow_up").length,
    stagnation_risk: players.filter((player) => player.category === "stagnation_risk").length,
    insufficient_data: players.filter((player) => player.category === "insufficient_data").length
  };
}

function mapObservedPlayer(player: PersistedPlayerSnapshot): YouthPipelineObservedPlayer {
  return {
    playerId: player.playerId,
    externalId: player.externalId,
    snapshotPlayerId: player.id,
    name: player.name,
    age: player.age,
    role: resolveRole(player),
    wage: player.wage,
    estimatedValue: player.estimatedValue,
    skills: player.skills
  };
}

function resolveRole(player: PersistedPlayerSnapshot): YouthPipelineObservedPlayer["role"] {
  if (player.observedPosition) return { label: player.observedPosition, source: "observed" };
  if (player.roles[0]) return { label: player.roles[0], source: "inferred" };
  return { label: "Undefined", source: "unknown" };
}

function hasCompleteSkills(player: PersistedPlayerSnapshot): boolean {
  return skillKeys.every((skill) => player.skills[skill] !== null);
}

function averageSkills(skills: Array<{ value: number | null }>): number | null {
  const values = skills
    .map((skill) => skill.value)
    .filter((value): value is number => value !== null);

  if (values.length === 0) {
    return null;
  }

  return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(2));
}

function buildDevelopmentIndex(
  players: PlayerDevelopmentPlayerSummary[]
): Map<string, PlayerDevelopmentPlayerSummary> {
  const index = new Map<string, PlayerDevelopmentPlayerSummary>();

  for (const player of players) {
    if (player.externalId) index.set(`external:${player.externalId}`, player);
    if (player.playerId) index.set(`player:${player.playerId}`, player);
  }

  return index;
}

function findDevelopmentSummary(
  player: PersistedPlayerSnapshot,
  index: Map<string, PlayerDevelopmentPlayerSummary>
): PlayerDevelopmentPlayerSummary | null {
  if (player.externalId) return index.get(`external:${player.externalId}`) ?? null;
  if (player.playerId) return index.get(`player:${player.playerId}`) ?? null;
  return null;
}

function buildMarketIndex(players: SquadMarketPlayerPlan[]): Map<string, SquadMarketPlayerPlan> {
  return new Map(players.map((player) => [player.snapshotPlayerId, player]));
}

function comparePlayerPlans(
  left: YouthPipelinePlayerPlan,
  right: YouthPipelinePlayerPlan
): number {
  return (
    categoryPriority(right.category) - categoryPriority(left.category) ||
    severityPriority(right.severity) - severityPriority(left.severity) ||
    left.name.localeCompare(right.name)
  );
}

function compareSignals(left: YouthPipelineSignal, right: YouthPipelineSignal): number {
  return severityPriority(right.severity) - severityPriority(left.severity);
}

function categoryPriority(category: YouthPipelineCategory): number {
  if (category === "stagnation_risk") return 4;
  if (category === "standout_prospect") return 3;
  if (category === "follow_up") return 2;
  return 1;
}

function severityPriority(severity: YouthPipelineSeverity): number {
  if (severity === "high") return 4;
  if (severity === "medium") return 3;
  if (severity === "low") return 2;
  return 1;
}

function buildRationale(category: YouthPipelineCategory): string {
  if (category === "standout_prospect") {
    return "Prospecto destacado dentro del plantel senior; no implica escuela juvenil real.";
  }

  if (category === "stagnation_risk") {
    return "Riesgo de estancamiento o deterioro observado que requiere seguimiento prudente.";
  }

  if (category === "follow_up") {
    return "Jugador joven senior para monitorear antes de extraer conclusiones fuertes.";
  }

  return "Datos insuficientes para clasificar con fuerza.";
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
