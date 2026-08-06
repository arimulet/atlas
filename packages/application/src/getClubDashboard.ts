import {
  MongoClubRepository,
  MongoSnapshotRepository,
  type PersistedClub,
  type PersistedSnapshot
} from "@atlas/database";
import { buildClubOperatingSettings, type ClubOperatingSettings } from "./clubOperatingSettings.js";
import { getPlayerDevelopment, type PlayerDevelopmentFinding } from "./getPlayerDevelopment.js";
import {
  getSquadMarketPlanning,
  type MarketPlanningCategory,
  type MarketPlanningConfidence,
  type MarketPlanningSeverity
} from "./getSquadMarketPlanning.js";
import {
  getYouthPipelinePlanning,
  type YouthPipelineCategory,
  type YouthPipelineConfidence,
  type YouthPipelineSeverity
} from "./getYouthPipelinePlanning.js";

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
  marketSummary: ClubDashboardMarketSummary;
  youthPipelineSummary: ClubDashboardYouthPipelineSummary;
  operationalAreas: Array<{
    key:
      | "diagnostic"
      | "history"
      | "findings"
      | "squad-economy"
      | "player-development"
      | "squad-market-planning"
      | "youth-pipeline-planning"
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

export interface ClubDashboardMarketSummary {
  available: boolean;
  detailPath: string;
  observed: {
    snapshotCount: number;
    latestSnapshotDate: string | null;
    playerCount: number;
    playersWithStableIdentity: number;
  };
  manual: {
    marketStrategy: string;
  };
  derived: {
    saleCandidates: number;
    protectionCandidates: number;
    followUpPlayers: number;
    insufficientSignalPlayers: number;
  };
  inferred: {
    headline: string;
    warning: string | null;
    highlightedPlayers: ClubDashboardMarketPlayer[];
  };
}

export interface ClubDashboardMarketPlayer {
  playerId: string | null;
  name: string;
  signal: MarketPlanningCategory;
  severity: MarketPlanningSeverity;
  confidence: MarketPlanningConfidence;
  timing: string;
}

export interface ClubDashboardYouthPipelineSummary {
  available: boolean;
  detailPath: string;
  observed: {
    snapshotCount: number;
    latestSnapshotDate: string | null;
    seniorPlayerCount: number;
    youngSeniorPlayerCount: number;
    youthAgeThreshold: number;
  };
  manual: {
    academyInvestment: string;
  };
  derived: {
    standoutProspects: number;
    followUpPlayers: number;
    stagnationRiskPlayers: number;
    insufficientDataPlayers: number;
  };
  inferred: {
    headline: string;
    warning: string | null;
    highlightedPlayers: ClubDashboardYouthPipelinePlayer[];
  };
}

export interface ClubDashboardYouthPipelinePlayer {
  playerId: string | null;
  name: string;
  signal: YouthPipelineCategory;
  severity: YouthPipelineSeverity;
  confidence: YouthPipelineConfidence;
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
  const [development, marketPlanning, youthPipeline] = await Promise.all([
    getPlayerDevelopment({ clubId: input.clubId }),
    getSquadMarketPlanning({ clubId: input.clubId }),
    getYouthPipelinePlanning({ clubId: input.clubId })
  ]);

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
    marketSummary: buildMarketSummary(input.clubId, snapshots.length, marketPlanning),
    youthPipelineSummary: buildYouthPipelineSummary(input.clubId, snapshots.length, youthPipeline),
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

function buildMarketSummary(
  clubId: string,
  snapshotCount: number,
  marketPlanning: Awaited<ReturnType<typeof getSquadMarketPlanning>>
): ClubDashboardMarketSummary {
  const counts = marketPlanning.derived.categoryCounts;
  const derived = {
    saleCandidates: counts.sale_candidate,
    protectionCandidates: counts.protection_candidate,
    followUpPlayers: counts.follow_up,
    insufficientSignalPlayers: counts.insufficient_signal
  };

  return {
    available: marketPlanning.snapshotId !== null,
    detailPath: `/clubs/${clubId}/squad-market-planning`,
    observed: {
      snapshotCount,
      latestSnapshotDate: marketPlanning.snapshotDate,
      playerCount: marketPlanning.observed.coverage.playerCount,
      playersWithStableIdentity: marketPlanning.observed.coverage.playersWithStableIdentity
    },
    manual: {
      marketStrategy: marketPlanning.manual.marketStrategy
    },
    derived,
    inferred: {
      headline: buildMarketHeadline(derived),
      warning: marketPlanning.warnings[0]?.message ?? null,
      highlightedPlayers: marketPlanning.derived.players
        .filter((player) => player.category !== "insufficient_signal")
        .map(mapHighlightedMarketPlayer)
        .sort(compareHighlightedMarketPlayers)
        .slice(0, 4)
    }
  };
}

function buildMarketHeadline(summary: ClubDashboardMarketSummary["derived"]): string {
  if (summary.insufficientSignalPlayers > 0) {
    return "Lectura prudente: hay jugadores con datos insuficientes para mercado interno.";
  }

  if (summary.saleCandidates > 0) {
    return "Hay candidatos internos para revisar timing de venta sin automatizar decisiones.";
  }

  if (summary.protectionCandidates > 0) {
    return "Hay activos propios con senales de proteccion patrimonial.";
  }

  if (summary.followUpPlayers > 0) {
    return "La senal principal es seguimiento interno de activos propios.";
  }

  return "Sin senales de mercado interno disponibles todavia.";
}

function mapHighlightedMarketPlayer(
  player: Awaited<ReturnType<typeof getSquadMarketPlanning>>["derived"]["players"][number]
): ClubDashboardMarketPlayer {
  return {
    playerId: player.playerId,
    name: player.name,
    signal: player.category,
    severity: player.severity,
    confidence: player.confidence,
    timing: player.timing.label
  };
}

function compareHighlightedMarketPlayers(
  left: ClubDashboardMarketPlayer,
  right: ClubDashboardMarketPlayer
): number {
  return (
    marketSignalPriority(right.signal) - marketSignalPriority(left.signal) ||
    left.name.localeCompare(right.name)
  );
}

function marketSignalPriority(signal: ClubDashboardMarketPlayer["signal"]): number {
  if (signal === "sale_candidate") return 4;
  if (signal === "protection_candidate") return 3;
  if (signal === "follow_up") return 2;
  return 1;
}

function buildYouthPipelineSummary(
  clubId: string,
  snapshotCount: number,
  youthPipeline: Awaited<ReturnType<typeof getYouthPipelinePlanning>>
): ClubDashboardYouthPipelineSummary {
  const counts = youthPipeline.derived.categoryCounts;
  const derived = {
    standoutProspects: counts.standout_prospect,
    followUpPlayers: counts.follow_up,
    stagnationRiskPlayers: counts.stagnation_risk,
    insufficientDataPlayers: counts.insufficient_data
  };

  return {
    available: youthPipeline.snapshotId !== null,
    detailPath: `/clubs/${clubId}/youth-pipeline-planning`,
    observed: {
      snapshotCount,
      latestSnapshotDate: youthPipeline.snapshotDate,
      seniorPlayerCount: youthPipeline.observed.coverage.seniorPlayerCount,
      youngSeniorPlayerCount: youthPipeline.observed.coverage.youngSeniorPlayerCount,
      youthAgeThreshold: youthPipeline.observed.youthAgeThreshold
    },
    manual: {
      academyInvestment: youthPipeline.manual.academyInvestment
    },
    derived,
    inferred: {
      headline: buildYouthPipelineHeadline(derived),
      warning: youthPipeline.warnings[0]?.message ?? null,
      highlightedPlayers: youthPipeline.derived.players
        .filter((player) => player.category !== "insufficient_data")
        .map((player) => ({
          playerId: player.playerId,
          name: player.name,
          signal: player.category,
          severity: player.severity,
          confidence: player.confidence
        }))
        .sort(compareHighlightedYouthPlayers)
        .slice(0, 4)
    }
  };
}

function buildYouthPipelineHeadline(
  summary: ClubDashboardYouthPipelineSummary["derived"]
): string {
  if (summary.insufficientDataPlayers > 0) {
    return "Lectura prudente: hay jovenes senior con datos insuficientes.";
  }

  if (summary.stagnationRiskPlayers > 0) {
    return "Hay jovenes senior con riesgo de estancamiento observado.";
  }

  if (summary.standoutProspects > 0) {
    return "Hay prospectos destacados dentro del plantel senior.";
  }

  if (summary.followUpPlayers > 0) {
    return "La senal principal es seguimiento de jovenes senior.";
  }

  return "Sin jovenes senior clasificables todavia.";
}

function compareHighlightedYouthPlayers(
  left: ClubDashboardYouthPipelinePlayer,
  right: ClubDashboardYouthPipelinePlayer
): number {
  return (
    youthSignalPriority(right.signal) - youthSignalPriority(left.signal) ||
    left.name.localeCompare(right.name)
  );
}

function youthSignalPriority(signal: YouthPipelineCategory): number {
  if (signal === "stagnation_risk") return 4;
  if (signal === "standout_prospect") return 3;
  if (signal === "follow_up") return 2;
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
