import {
  MongoClubRepository,
  MongoSnapshotRepository,
  type PersistedPlayerSnapshot,
  type PersistedSnapshot,
  type SnapshotSkillSet
} from "@atlas/database";
import { buildClubOperatingSettings } from "./clubOperatingSettings.js";

type SkillKey = keyof SnapshotSkillSet;
type SkillChangeDirection = "up" | "down" | "stable" | "insufficient_data";
type DevelopmentConfidence = "low" | "medium" | "high";

export interface GetPlayerDevelopmentInput {
  clubId: string;
}

export interface PlayerDevelopment {
  clubId: string;
  snapshotCount: number;
  snapshotDates: string[];
  observed: {
    latestSnapshotId: string | null;
    latestSnapshotDate: string | null;
    players: PlayerDevelopmentObservedPlayer[];
  };
  manual: {
    trainingPriority: string;
  };
  derived: {
    players: PlayerDevelopmentPlayerSummary[];
  };
  warnings: PlayerDevelopmentWarning[];
}

export interface PlayerDevelopmentObservedPlayer {
  playerId: string | null;
  externalId: string | null;
  snapshotPlayerId: string;
  name: string;
  age: number;
  observedPosition: string | null;
  roles: string[];
  skills: SnapshotSkillSet;
}

export interface PlayerDevelopmentPlayerSummary {
  playerId: string | null;
  externalId: string | null;
  name: string;
  age: number;
  role: {
    label: string;
    source: "observed" | "inferred" | "unknown";
  };
  relevantSkills: Array<{
    skill: SkillKey;
    value: number | null;
  }>;
  skillChanges: PlayerSkillChange[];
  recentEvolution: {
    direction: SkillChangeDirection;
    improvedSkills: number;
    declinedSkills: number;
    stableSkills: number;
    comparableSkills: number;
    confidence: DevelopmentConfidence;
  };
  signals: PlayerDevelopmentSignal[];
  warnings: PlayerDevelopmentWarning[];
}

export interface PlayerSkillChange {
  skill: SkillKey;
  direction: SkillChangeDirection;
  previousValue: number | null;
  currentValue: number | null;
  delta: number | null;
}

export interface PlayerDevelopmentSignal {
  code: string;
  confidence: DevelopmentConfidence;
  message: string;
  evidence: DevelopmentEvidence[];
}

export interface PlayerDevelopmentWarning {
  code: string;
  message: string;
  evidence: DevelopmentEvidence[];
}

export interface DevelopmentEvidence {
  kind: "observed" | "manual" | "derived" | "inferred";
  label: string;
  value: string | number | null;
}

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

const roleRelevantSkills: Record<string, SkillKey[]> = {
  goalkeeper: ["keeper", "pace", "passing"],
  defender: ["defender", "pace", "technique", "passing"],
  midfielder: ["playmaker", "passing", "technique", "pace"],
  winger: ["pace", "technique", "passing", "playmaker"],
  striker: ["striker", "pace", "technique"],
  trainee: ["pace", "technique", "passing", "playmaker", "striker", "defender"],
  undefined: ["pace", "technique", "passing", "playmaker"]
};

const clubRepository = new MongoClubRepository();
const snapshotRepository = new MongoSnapshotRepository();

export async function getPlayerDevelopment(
  input: GetPlayerDevelopmentInput
): Promise<PlayerDevelopment> {
  const club = await clubRepository.findById(input.clubId);

  if (!club) {
    throw new Error(`Club not found: ${input.clubId}`);
  }

  const snapshots = await snapshotRepository.listByClub(input.clubId);
  const latest = snapshots.at(-1) ?? null;
  const trainingPriority =
    buildClubOperatingSettings(club).effective.preferences["training.priority"];
  const warnings = buildGlobalWarnings(snapshots);

  if (!latest) {
    return {
      clubId: input.clubId,
      snapshotCount: 0,
      snapshotDates: [],
      observed: {
        latestSnapshotId: null,
        latestSnapshotDate: null,
        players: []
      },
      manual: { trainingPriority },
      derived: { players: [] },
      warnings
    };
  }

  return {
    clubId: input.clubId,
    snapshotCount: snapshots.length,
    snapshotDates: snapshots.map((snapshot) => formatDate(snapshot.snapshotDate)),
    observed: {
      latestSnapshotId: latest.id,
      latestSnapshotDate: formatDate(latest.snapshotDate),
      players: latest.players.map(mapObservedPlayer)
    },
    manual: { trainingPriority },
    derived: {
      players: buildPlayerSummaries(snapshots, latest, trainingPriority)
    },
    warnings
  };
}

function buildPlayerSummaries(
  snapshots: PersistedSnapshot[],
  latest: PersistedSnapshot,
  trainingPriority: string
): PlayerDevelopmentPlayerSummary[] {
  const latestIdentityIndex = buildIdentityIndex(latest.players);

  return latest.players
    .map((player) => buildPlayerSummary(player, snapshots, latestIdentityIndex, trainingPriority))
    .sort((left, right) => {
      const rightNet = right.recentEvolution.improvedSkills - right.recentEvolution.declinedSkills;
      const leftNet = left.recentEvolution.improvedSkills - left.recentEvolution.declinedSkills;

      return rightNet - leftNet || left.name.localeCompare(right.name);
    });
}

function buildPlayerSummary(
  player: PersistedPlayerSnapshot,
  snapshots: PersistedSnapshot[],
  latestIdentityIndex: Map<string, PersistedPlayerSnapshot[]>,
  trainingPriority: string
): PlayerDevelopmentPlayerSummary {
  const role = resolveRole(player);
  const relevantSkillKeys = readRelevantSkills(role.label);
  const relevantSkills = relevantSkillKeys.map((skill) => ({ skill, value: player.skills[skill] }));
  const playerWarnings = buildPlayerWarnings(player, snapshots, latestIdentityIndex);
  const previous = findPreviousComparablePlayer(player, snapshots);
  const skillChanges = skillKeys.map((skill) => buildSkillChange(skill, previous, player));
  const recentEvolution = summarizeSkillChanges(skillChanges, playerWarnings);
  const signals = buildSignals(skillChanges, recentEvolution, player, trainingPriority);

  return {
    playerId: player.playerId,
    externalId: player.externalId,
    name: player.name,
    age: player.age,
    role,
    relevantSkills,
    skillChanges,
    recentEvolution,
    signals,
    warnings: playerWarnings
  };
}

function buildGlobalWarnings(snapshots: PersistedSnapshot[]): PlayerDevelopmentWarning[] {
  if (snapshots.length === 0) {
    return [
      {
        code: "no_snapshots",
        message: "El desarrollo de jugadores necesita snapshots de plantilla importados.",
        evidence: [{ kind: "observed", label: "Snapshots disponibles", value: 0 }]
      }
    ];
  }

  if (snapshots.length < 2) {
    return [
      {
        code: "few_snapshots",
        message: "Hay pocos snapshots; ATLAS solo muestra datos actuales sin evaluar evolucion.",
        evidence: [{ kind: "observed", label: "Snapshots disponibles", value: snapshots.length }]
      }
    ];
  }

  return [];
}

function buildPlayerWarnings(
  player: PersistedPlayerSnapshot,
  snapshots: PersistedSnapshot[],
  latestIdentityIndex: Map<string, PersistedPlayerSnapshot[]>
): PlayerDevelopmentWarning[] {
  const warnings: PlayerDevelopmentWarning[] = [];
  const missingSkills = skillKeys.filter((skill) => player.skills[skill] === null);

  if (!player.externalId) {
    warnings.push({
      code: "ambiguous_identity",
      message: "Falta identidad estable; no se fusiona historial automaticamente.",
      evidence: [
        { kind: "observed", label: "Jugador", value: player.name },
        { kind: "observed", label: "External id", value: player.externalId }
      ]
    });
  }

  if (player.externalId && (latestIdentityIndex.get(player.externalId)?.length ?? 0) > 1) {
    warnings.push({
      code: "ambiguous_identity",
      message: "La identidad estable aparece duplicada en el snapshot actual.",
      evidence: [
        { kind: "observed", label: "Jugador", value: player.name },
        { kind: "observed", label: "External id", value: player.externalId }
      ]
    });
  }

  if (snapshots.length < 2) {
    warnings.push({
      code: "insufficient_history",
      message: "No existe historial suficiente para evaluar evolucion del jugador.",
      evidence: [{ kind: "observed", label: "Snapshots disponibles", value: snapshots.length }]
    });
  }

  if (missingSkills.length > 0) {
    warnings.push({
      code: "missing_skills",
      message:
        "Faltan habilidades visibles; las comparaciones se calculan solo con datos presentes.",
      evidence: [
        { kind: "observed", label: "Jugador", value: player.name },
        { kind: "observed", label: "Habilidades faltantes", value: missingSkills.join(", ") }
      ]
    });
  }

  return warnings;
}

function buildSkillChange(
  skill: SkillKey,
  previous: PersistedPlayerSnapshot | null,
  current: PersistedPlayerSnapshot
): PlayerSkillChange {
  const previousValue = previous?.skills[skill] ?? null;
  const currentValue = current.skills[skill];

  if (previousValue === null || currentValue === null) {
    return {
      skill,
      direction: "insufficient_data",
      previousValue,
      currentValue,
      delta: null
    };
  }

  const delta = currentValue - previousValue;

  return {
    skill,
    direction: classifyDelta(delta),
    previousValue,
    currentValue,
    delta
  };
}

function summarizeSkillChanges(
  changes: PlayerSkillChange[],
  warnings: PlayerDevelopmentWarning[]
): PlayerDevelopmentPlayerSummary["recentEvolution"] {
  const improvedSkills = changes.filter((change) => change.direction === "up").length;
  const declinedSkills = changes.filter((change) => change.direction === "down").length;
  const stableSkills = changes.filter((change) => change.direction === "stable").length;
  const comparableSkills = improvedSkills + declinedSkills + stableSkills;

  return {
    direction:
      comparableSkills === 0 ? "insufficient_data" : classifyDelta(improvedSkills - declinedSkills),
    improvedSkills,
    declinedSkills,
    stableSkills,
    comparableSkills,
    confidence: confidenceFromEvidence(comparableSkills, warnings)
  };
}

function buildSignals(
  changes: PlayerSkillChange[],
  evolution: PlayerDevelopmentPlayerSummary["recentEvolution"],
  player: PersistedPlayerSnapshot,
  trainingPriority: string
): PlayerDevelopmentSignal[] {
  const signals: PlayerDevelopmentSignal[] = [];

  if (evolution.comparableSkills === 0) {
    signals.push({
      code: "needs_more_history",
      confidence: "low",
      message: "Sin dos puntos comparables no hay lectura prudente de evolucion.",
      evidence: [{ kind: "derived", label: "Habilidades comparables", value: 0 }]
    });
    return signals;
  }

  if (evolution.improvedSkills > evolution.declinedSkills) {
    signals.push({
      code: "observed_skill_growth",
      confidence: evolution.confidence,
      message: "Hay mejora observada en mas habilidades que deterioros.",
      evidence: [
        { kind: "observed", label: "Jugador", value: player.name },
        { kind: "derived", label: "Habilidades que subieron", value: evolution.improvedSkills },
        { kind: "derived", label: "Habilidades que bajaron", value: evolution.declinedSkills }
      ]
    });
  }

  if (evolution.declinedSkills > 0) {
    signals.push({
      code: "observed_skill_decline",
      confidence: evolution.confidence,
      message: "Hay deterioro observado en al menos una habilidad visible.",
      evidence: [
        { kind: "derived", label: "Habilidades que bajaron", value: evolution.declinedSkills }
      ]
    });
  }

  signals.push({
    code: "training_priority_context",
    confidence: "low",
    message: "La prioridad de entrenamiento se muestra solo como contexto manual del club.",
    evidence: [
      { kind: "manual", label: "training.priority", value: trainingPriority },
      { kind: "inferred", label: "Causalidad atribuida", value: "No" }
    ]
  });

  return signals;
}

function findPreviousComparablePlayer(
  player: PersistedPlayerSnapshot,
  snapshots: PersistedSnapshot[]
): PersistedPlayerSnapshot | null {
  if (!player.externalId) {
    return null;
  }

  const previousSnapshots = snapshots.slice(0, -1).reverse();

  for (const snapshot of previousSnapshots) {
    const matches = snapshot.players.filter(
      (candidate) => candidate.externalId === player.externalId
    );

    if (matches.length === 1) {
      return matches[0]!;
    }
  }

  return null;
}

function buildIdentityIndex(
  players: PersistedPlayerSnapshot[]
): Map<string, PersistedPlayerSnapshot[]> {
  const index = new Map<string, PersistedPlayerSnapshot[]>();

  for (const player of players) {
    if (player.externalId) {
      index.set(player.externalId, [...(index.get(player.externalId) ?? []), player]);
    }
  }

  return index;
}

function mapObservedPlayer(player: PersistedPlayerSnapshot): PlayerDevelopmentObservedPlayer {
  return {
    playerId: player.playerId,
    externalId: player.externalId,
    snapshotPlayerId: player.id,
    name: player.name,
    age: player.age,
    observedPosition: player.observedPosition,
    roles: player.roles,
    skills: player.skills
  };
}

function resolveRole(player: PersistedPlayerSnapshot): PlayerDevelopmentPlayerSummary["role"] {
  if (player.observedPosition) {
    return { label: player.observedPosition, source: "observed" };
  }

  if (player.roles[0]) {
    return { label: player.roles[0], source: "inferred" };
  }

  return { label: "Undefined", source: "unknown" };
}

function readRelevantSkills(roleLabel: string): SkillKey[] {
  return roleRelevantSkills[roleLabel.toLowerCase()] ?? roleRelevantSkills.undefined ?? [];
}

function confidenceFromEvidence(
  comparableSkills: number,
  warnings: PlayerDevelopmentWarning[]
): DevelopmentConfidence {
  if (comparableSkills < 4 || warnings.some((warning) => warning.code === "ambiguous_identity")) {
    return "low";
  }

  if (warnings.length > 0) {
    return "medium";
  }

  return "high";
}

function classifyDelta(delta: number): SkillChangeDirection {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "stable";
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
