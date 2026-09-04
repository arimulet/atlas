import {
  MongoClubRepository,
  MongoSnapshotRepository,
  PersistedClub,
  PersistedPlayerSnapshot,
  MongoCountryRepository,
  type PersistedSnapshot
} from "@atlas/database";
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
  UpdateClubProfileInput,
  ValidatedManualProfileUpdate
} from "./types";
import {
  compareSnapshots,
  SnapshotComparison,
  SnapshotComparisonPlayer,
  SnapshotComparisonSnapshot
} from "@atlas/domain";
import { formatDate, normalizeNullableString, validateWeek } from "@atlas/utils";
import {
  Category,
  ClubId,
  FindingType,
  KeyValue,
  buildClubOperatingSettings,
  getPlayerDevelopment,
  getSquadMarketPlanning,
  getYouthPipelinePlanning
} from "@atlas/application";

const clubRepository = new MongoClubRepository();
const snapshotRepository = new MongoSnapshotRepository();
const countryRepository = new MongoCountryRepository();

export const getClubDashboard = async (clubId: ClubId): Promise<ClubDashboard> => {
  const club = await clubRepository.findById(clubId.toString());

  if (!club) {
    throw new Error(`Club not found: ${clubId}`);
  }

  const snapshots = await snapshotRepository.listByClub(clubId);
  const latest = snapshots.at(-1) ?? null;
  const previous = snapshots.at(-2) ?? null;
  const [development, marketPlanning, youthPipeline, countryDetails] = await Promise.all([
    getPlayerDevelopment(clubId),
    getSquadMarketPlanning(clubId),
    getYouthPipelinePlanning(clubId),
    countryRepository.getById(club.country)
  ]);

  return {
    club,
    countryDetails,
    settings: buildClubOperatingSettings(club),
    snapshots: {
      available: snapshots.length > 0,
      count: snapshots.length,
      latest: latest ? mapSnapshotSummary(latest) : null,
      previous: previous ? mapSnapshotSummary(previous) : null,
      canCompare: snapshots.length >= 2
    },
    trainingSummary: buildTrainingSummary(latest),
    developmentSummary: buildDevelopmentSummary(clubId, development),
    marketSummary: buildMarketSummary(clubId, snapshots.length, marketPlanning),
    youthPipelineSummary: buildYouthPipelineSummary(clubId, snapshots.length, youthPipeline),
    operationalAreas: buildOperationalAreas(snapshots.length)
  };
};

function buildTrainingSummary(
  snapshot: PersistedSnapshot | null
): ClubDashboard["trainingSummary"] {
  if (!snapshot) {
    return {
      available: false,
      observed: {
        latestSnapshotDate: null,
        playerCount: 0,
        playersWithTrainingData: 0,
        advancedPlayers: 0,
        formationPlayers: 0
      }
    };
  }

  const playersWithTrainingData = snapshot.players.length;
  const advancedPlayers = snapshot.players.filter((player) => player.training.advanced).length;

  return {
    available: true,
    observed: {
      latestSnapshotDate: snapshot.snapshotDate.toISOString().slice(0, 10),
      playerCount: snapshot.players.length,
      playersWithTrainingData,
      advancedPlayers,
      formationPlayers: playersWithTrainingData - advancedPlayers
    }
  };
}

export const getClubProfile = async (clubId: ClubId): Promise<PersistedClub> => {
  const club = await clubRepository.findById(clubId.toString());

  if (!club) {
    throw new Error(`Club not found: ${clubId}`);
  }

  return club;
};

export const getUserClubs = async (ownerUserId: string): Promise<PersistedClub[]> => {
  return clubRepository.findClubsByOwnerUserId(ownerUserId);
};

export const updateClubProfile = async (input: UpdateClubProfileInput): Promise<PersistedClub> => {
  return clubRepository.updateManualProfile({
    clubId: input.clubId,
    ...validateManualProfileUpdate(input.settings)
  });
};

export const getClubSnapshots = async (clubId: ClubId): Promise<ClubDashboardSnapshotSummary[]> => {
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
};

function validateManualProfileUpdate(
  manual: ValidatedManualProfileUpdate
): ValidatedManualProfileUpdate {
  const validated: ValidatedManualProfileUpdate = {};

  if ("name" in manual) validated.name = normalizeNullableString(manual.name);
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

function buildDevelopmentSummary(
  clubId: ClubId,
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
    settings: {
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
  type: FindingType
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
  clubId: ClubId,
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
    settings: {
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
  clubId: ClubId,
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
    settings: {
      academyInvestment: youthPipeline.manual.academyInvestment
    },
    derived,
    inferred: {
      headline: buildYouthPipelineHeadline(
        derived,
        youthPipeline.observed.coverage.youngSeniorPlayerCount,
        snapshotCount
      ),
      warning: youthPipeline.warnings[0]?.message ?? null,
      highlightedPlayers: youthPipeline.derived.players
        .filter((player) => player.category !== "insufficient_data")
        .map((player) => ({
          playerId: player.playerId ?? null,
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
  summary: ClubDashboardYouthPipelineSummary["derived"],
  youngSeniorPlayerCount?: number,
  snapshotCount?: number
): string {
  if (snapshotCount === 0) {
    return "Sin snapshots importados para analizar jovenes del plantel senior.";
  }

  if (youngSeniorPlayerCount === 0) {
    return "No se observan jugadores jovenes (<= 23) en el plantel senior.";
  }

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

function youthSignalPriority(signal: Category): number {
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
    clubId: String(snapshot.clubId),
    snapshotDate: snapshot.snapshotDate.toISOString().slice(0, 10),
    importedAt: snapshot.importedAt.toISOString(),
    gameWeek: snapshot.gameWeek,
    week: snapshot.week,
    playerCount: snapshot.players.length
  };
}

async function resolveSnapshot(
  clubId: ClubId,
  snapshotId: string | undefined,
  snapshotDate: string | undefined,
  role: "base" | "target"
): Promise<PersistedSnapshot> {
  const club = await clubRepository.findById(clubId.toString());
  if (!club) {
    throw new Error(`${role} snapshot not found for club.`);
  }

  if (snapshotId) {
    const snapshot = await snapshotRepository.findById(snapshotId);

    if (!snapshot || snapshot.clubId !== club.clubId) {
      throw new Error(`${role} snapshot not found for club.`);
    }

    return snapshot;
  }

  if (!snapshotDate) {
    throw new Error(`${role} snapshot id or date is required.`);
  }

  const snapshots = await snapshotRepository.findByClubAndDate(
    club.clubId,
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
    clubId: String(snapshot.clubId),
    snapshotDate: formatDate(snapshot.snapshotDate),
    players: snapshot.players.map(mapPlayer)
  };
}

function mapPlayer(player: PersistedPlayerSnapshot): SnapshotComparisonPlayer {
  return {
    id: player.id,
    playerId: player.playerId,
    name: player.name,
    age: player.age,
    wage: { amount: player.wage, currency: null },
    value: { amount: player.value, currency: null },
    skills: player.skills
  };
}

export * from "./types.js";
