import {
  MongoClubRepository,
  MongoSnapshotRepository,
  type PersistedClub,
  type PersistedSnapshot
} from "@atlas/database";
import { buildClubOperatingSettings, type ClubOperatingSettings } from "./clubOperatingSettings.js";
import { getPlayerDevelopment, type PlayerDevelopmentFinding } from "./getPlayerDevelopment.js";

export interface GetClubDashboardInput {
  clubId: string;
}

export interface ClubDashboard {
  club: PersistedClub;
  settings: ClubOperatingSettings;
  snapshots: {
    available: boolean;
    count: number;
    latest: ClubDashboardSnapshotSummary | null;
    previous: ClubDashboardSnapshotSummary | null;
    canCompare: boolean;
  };
  developmentSummary: ClubDashboardDevelopmentSummary;
  operationalAreas: Array<{
    key:
      | "diagnostic"
      | "history"
      | "findings"
      | "squad-economy"
      | "player-development"
      | "training"
      | "academy"
      | "market";
    label: string;
    status: "available" | "ready" | "planned";
    summary: string;
  }>;
}

export interface ClubDashboardSnapshotSummary {
  id: string;
  snapshotDate: string;
  importedAt: string;
  season: number | null;
  week: number | null;
  playerCount: number;
}

export interface ClubDashboardDevelopmentSummary {
  available: boolean;
  detailPath: string;
  observed: {
    snapshotCount: number;
    latestSnapshotDate: string | null;
    playerCount: number;
  };
  manual: {
    trainingPriority: string;
  };
  derived: {
    improvingPlayers: number;
    stagnatedPlayers: number;
    decliningPlayers: number;
    insufficientDataPlayers: number;
  };
  inferred: {
    headline: string;
    warning: string | null;
    highlightedPlayers: ClubDashboardDevelopmentPlayer[];
  };
}

export interface ClubDashboardDevelopmentPlayer {
  playerId: string | null;
  name: string;
  signal: "improvement" | "stagnation" | "decline" | "insufficient_data";
  severity: "info" | "low" | "medium" | "high";
  confidence: "low" | "medium" | "high";
}

const clubRepository = new MongoClubRepository();
const snapshotRepository = new MongoSnapshotRepository();

export async function getClubDashboard(input: GetClubDashboardInput): Promise<ClubDashboard> {
  const club = await clubRepository.findById(input.clubId);

  if (!club) {
    throw new Error(`Club not found: ${input.clubId}`);
  }

  const snapshots = await snapshotRepository.listByClub(input.clubId);
  const latest = snapshots.at(-1) ?? null;
  const previous = snapshots.at(-2) ?? null;
  const development = await getPlayerDevelopment({ clubId: input.clubId });

  return {
    club,
    settings: buildClubOperatingSettings(club),
    snapshots: {
      available: snapshots.length > 0,
      count: snapshots.length,
      latest: latest ? mapSnapshotSummary(latest) : null,
      previous: previous ? mapSnapshotSummary(previous) : null,
      canCompare: snapshots.length >= 2
    },
    developmentSummary: buildDevelopmentSummary(input.clubId, development),
    operationalAreas: buildOperationalAreas(snapshots.length)
  };
}

function buildDevelopmentSummary(
  clubId: string,
  development: Awaited<ReturnType<typeof getPlayerDevelopment>>
): ClubDashboardDevelopmentSummary {
  const counts = {
    improvingPlayers: countPlayersByFinding(development, "improvement"),
    stagnatedPlayers: countPlayersByFinding(development, "stagnation"),
    decliningPlayers: countPlayersByFinding(development, "decline"),
    insufficientDataPlayers: countPlayersByFinding(development, "insufficient_data")
  };
  const warning = development.warnings[0]?.message ?? null;

  return {
    available: development.snapshotCount > 0,
    detailPath: `/clubs/${clubId}/player-development`,
    observed: {
      snapshotCount: development.snapshotCount,
      latestSnapshotDate: development.observed.latestSnapshotDate,
      playerCount: development.observed.players.length
    },
    manual: {
      trainingPriority: development.manual.trainingPriority
    },
    derived: counts,
    inferred: {
      headline: buildDevelopmentHeadline(counts),
      warning,
      highlightedPlayers: development.derived.players
        .map(mapHighlightedDevelopmentPlayer)
        .filter((player) => player !== null)
        .sort(compareHighlightedPlayers)
        .slice(0, 4)
    }
  };
}

function countPlayersByFinding(
  development: Awaited<ReturnType<typeof getPlayerDevelopment>>,
  type: PlayerDevelopmentFinding["type"]
): number {
  return development.derived.players.filter((player) =>
    player.findings.some((finding) => finding.type === type)
  ).length;
}

function buildDevelopmentHeadline(summary: ClubDashboardDevelopmentSummary["derived"]): string {
  if (summary.insufficientDataPlayers > 0) {
    return "Lectura prudente: hay jugadores con datos insuficientes.";
  }

  if (summary.decliningPlayers > 0) {
    return "Revisar deterioros observados antes de tomar decisiones de plantilla.";
  }

  if (summary.improvingPlayers > 0) {
    return "Hay mejoras observadas en habilidades visibles.";
  }

  if (summary.stagnatedPlayers > 0) {
    return "La senal principal es estancamiento observado.";
  }

  return "Sin senales de desarrollo disponibles todavia.";
}

function mapHighlightedDevelopmentPlayer(
  player: Awaited<ReturnType<typeof getPlayerDevelopment>>["derived"]["players"][number]
): ClubDashboardDevelopmentPlayer | null {
  const finding = player.findings[0];

  if (!finding) {
    return null;
  }

  return {
    playerId: player.playerId,
    name: player.name,
    signal: finding.type,
    severity: finding.severity,
    confidence: finding.confidence
  };
}

function compareHighlightedPlayers(
  left: ClubDashboardDevelopmentPlayer,
  right: ClubDashboardDevelopmentPlayer
): number {
  return (
    signalPriority(right.signal) - signalPriority(left.signal) ||
    left.name.localeCompare(right.name)
  );
}

function signalPriority(signal: ClubDashboardDevelopmentPlayer["signal"]): number {
  if (signal === "decline") return 4;
  if (signal === "stagnation") return 3;
  if (signal === "improvement") return 2;
  return 1;
}

function buildOperationalAreas(snapshotCount: number): ClubDashboard["operationalAreas"] {
  const hasSnapshot = snapshotCount > 0;
  const hasHistory = snapshotCount >= 2;

  return [
    {
      key: "diagnostic",
      label: "Diagnostico",
      status: hasSnapshot ? "available" : "ready",
      summary: hasSnapshot
        ? "Disponible con el ultimo snapshot importado."
        : "Listo cuando exista un snapshot de plantilla."
    },
    {
      key: "history",
      label: "Analisis historico",
      status: hasHistory ? "available" : "ready",
      summary: hasHistory
        ? "Comparacion y tendencias disponibles."
        : "Requiere al menos dos snapshots del club."
    },
    {
      key: "findings",
      label: "Hallazgos",
      status: hasHistory ? "available" : "ready",
      summary: hasHistory
        ? "Hallazgos patrimoniales multitemporada disponibles."
        : "Se activan con historial suficiente."
    },
    {
      key: "squad-economy",
      label: "Economia de plantilla",
      status: hasSnapshot ? "available" : "ready",
      summary: hasSnapshot
        ? "Disponible desde salarios y valores observados."
        : "Listo cuando exista un snapshot de plantilla."
    },
    {
      key: "player-development",
      label: "Desarrollo de jugadores",
      status: hasSnapshot ? "available" : "ready",
      summary: hasHistory
        ? "Evolucion observada de habilidades disponible."
        : "Muestra datos actuales; requiere historial para evolucion."
    },
    {
      key: "training",
      label: "Entrenamiento",
      status: "planned",
      summary: "Acceso futuro; modulo no implementado todavia."
    },
    {
      key: "academy",
      label: "Cantera",
      status: "planned",
      summary: "Acceso futuro; modulo no implementado todavia."
    },
    {
      key: "squad-market-planning",
      label: "Planificacion interna de mercado",
      status: hasSnapshot ? "available" : "ready",
      summary: hasSnapshot
        ? "Candidatos internos de venta, proteccion y seguimiento."
        : "Listo cuando exista un snapshot de plantilla."
    },
    {
      key: "youth-pipeline-planning",
      label: "Pipeline juvenil senior",
      status: hasSnapshot ? "available" : "ready",
      summary: hasSnapshot
        ? "Jovenes del plantel senior con senales prudentes."
        : "Listo cuando exista un snapshot de plantilla."
    }
  ];
}

function mapSnapshotSummary(snapshot: PersistedSnapshot): ClubDashboardSnapshotSummary {
  return {
    id: snapshot.id,
    snapshotDate: snapshot.snapshotDate.toISOString().slice(0, 10),
    importedAt: snapshot.importedAt.toISOString(),
    season: snapshot.season,
    week: snapshot.week,
    playerCount: snapshot.players.length
  };
}
