import {
  MongoClubRepository,
  MongoSnapshotRepository,
  PersistedClub,
  PersistedPlayerSnapshot,
  type PersistedSnapshot
} from "@atlas/database";
import { buildClubOperatingSettings } from "../clubOperatingSettings/index.js";
import { getPlayerDevelopment } from "../playerDevelopment/index.js";
import { type PlayerDevelopmentFinding } from "../playerDevelopment/types.js";
import { getSquadMarketPlanning } from "../marketPlanning/index.js";
import { getYouthPipelinePlanning } from "../playerDevelopment/index.js";
import { type YouthPipelineCategory } from "../playerDevelopment/types.js";
import {
  ClubDashboard,
  ClubDashboardDevelopmentPlayer,
  ClubDashboardDevelopmentSummary,
  ClubDashboardMarketPlayer,
  ClubDashboardMarketSummary,
  ClubDashboardSnapshotSummary,
  ClubDashboardYouthPipelinePlayer,
  ClubDashboardYouthPipelineSummary,
  CompareClubSnapshotsInput,
  GetClubDashboardInput,
  GetClubProfileInput,
  UpdateClubProfileInput,
  ValidatedManualProfileUpdate
} from "./types";
import { compareSnapshots, SnapshotComparison, SnapshotComparisonPlayer, SnapshotComparisonSnapshot } from "@atlas/domain";
import { KeyValue } from "../types.js";

const clubRepository = new MongoClubRepository();
const snapshotRepository = new MongoSnapshotRepository();

export const getClubDashboard = async (input: GetClubDashboardInput): Promise<ClubDashboard> => {
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
};

export const getClubProfile = async (input: GetClubProfileInput): Promise<PersistedClub> => {
  const club = await clubRepository.findById(input.clubId);

  if (!club) {
    throw new Error(`Club not found: ${input.clubId}`);
  }

  return club;
};

export const updateClubProfile = async (input: UpdateClubProfileInput): Promise<PersistedClub> => {
  return clubRepository.updateManualProfile({
    clubId: input.clubId,
    ...validateManualProfileUpdate(input.manual)
  });
};

export const getClubSnapshots = async (clubId: string): Promise<ClubDashboardSnapshotSummary[]> => {
  const snapshots = await snapshotRepository.listByClub(clubId);

  return snapshots.map(mapSnapshotSummary);
};


export const compareClubSnapshots = async (
  input: CompareClubSnapshotsInput
): Promise<SnapshotComparison> => {
  const [baseSnapshot, targetSnapshot] = await Promise.all([
    resolveSnapshot(input.clubId, input.baseSnapshotId, input.baseSnapshotDate, "base"),
    resolveSnapshot(input.clubId, input.targetSnapshotId, input.targetSnapshotDate, "target")
  ]);

  return compareSnapshots(mapSnapshot(baseSnapshot), mapSnapshot(targetSnapshot));
}


function validateManualProfileUpdate(
  manual: ValidatedManualProfileUpdate
): ValidatedManualProfileUpdate {
  const validated: ValidatedManualProfileUpdate = {};

  if ("name" in manual) validated.name = normalizeNullableString(manual.name);
  if ("currency" in manual) validated.currency = validateCurrency(manual.currency);
  if ("season" in manual) validated.season = validateSeason(manual.season);
  if ("week" in manual) validated.week = validateWeek(manual.week);
  if (manual.assumptions) validated.assumptions = validateManualRecords(manual.assumptions);
  if (manual.preferences) validated.preferences = validateManualRecords(manual.preferences);

  return validated;
}

function validateManualRecords(records: KeyValue[]) {
  return records.map((record) => {
    const key = normalizeNullableString(record.key);
    const value = normalizeNullableString(record.value);

    if (!key || !value) {
      throw new Error("Manual records must include non-empty key and value.");
    }

    return { key, value };
  });
}

function validateSeason(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isInteger(value) || value < 1 || value > 999) {
    throw new Error("Operating season must be an integer between 1 and 999.");
  }

  return value;
}

function validateWeek(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isInteger(value) || value < 1 || value > 16) {
    throw new Error("Operating week must be an integer between 1 and 16.");
  }

  return value;
}

function normalizeNullableString(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function validateCurrency(value: string | null | undefined): string | null {
  const normalized = normalizeNullableString(value)?.toUpperCase() ?? null;

  if (normalized === null) {
    return null;
  }

  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error("Operating currency must be a 3-letter ISO currency code.");
  }

  return normalized;
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

function buildYouthPipelineHeadline(summary: ClubDashboardYouthPipelineSummary["derived"]): string {
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
    clubId: snapshot.clubId,
    snapshotDate: snapshot.snapshotDate.toISOString().slice(0, 10),
    importedAt: snapshot.importedAt.toISOString(),
    season: snapshot.season,
    week: snapshot.week,
    playerCount: snapshot.players.length
  };
}



async function resolveSnapshot(
  clubId: string,
  snapshotId: string | undefined,
  snapshotDate: string | undefined,
  role: "base" | "target"
): Promise<PersistedSnapshot> {
  if (snapshotId) {
    const snapshot = await snapshotRepository.findById(snapshotId);

    if (!snapshot || snapshot.clubId !== clubId) {
      throw new Error(`${role} snapshot not found for club.`);
    }

    return snapshot;
  }

  if (!snapshotDate) {
    throw new Error(`${role} snapshot id or date is required.`);
  }

  const snapshots = await snapshotRepository.findByClubAndDate(
    clubId,
    new Date(`${snapshotDate}T00:00:00.000Z`)
  );

  if (snapshots.length === 0) {
    throw new Error(`${role} snapshot not found for date ${snapshotDate}.`);
  }

  if (snapshots.length > 1) {
    throw new Error(`${role} snapshot date ${snapshotDate} is ambiguous; use snapshot id.`);
  }

  return snapshots[0]!;
}

function mapSnapshot(snapshot: PersistedSnapshot): SnapshotComparisonSnapshot {
  return {
    id: snapshot.id,
    clubId: snapshot.clubId,
    snapshotDate: toDateOnly(snapshot.snapshotDate),
    players: snapshot.players.map(mapPlayer)
  };
}

function mapPlayer(player: PersistedPlayerSnapshot): SnapshotComparisonPlayer {
  return {
    id: player.id,
    playerId: player.playerId,
    externalId: player.externalId,
    name: player.name,
    age: player.age,
    wage: player.wage,
    estimatedValue: player.estimatedValue,
    skills: player.skills
  };
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
