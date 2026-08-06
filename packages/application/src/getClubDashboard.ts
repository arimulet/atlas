import {
  MongoClubRepository,
  MongoSnapshotRepository,
  type PersistedClub,
  type PersistedSnapshot
} from "@atlas/database";
import { buildClubOperatingSettings, type ClubOperatingSettings } from "./clubOperatingSettings.js";

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
  operationalAreas: Array<{
    key:
      | "diagnostic"
      | "history"
      | "findings"
      | "squad-economy"
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
    operationalAreas: buildOperationalAreas(snapshots.length)
  };
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
      key: "market",
      label: "Mercado",
      status: "planned",
      summary: "Acceso futuro; modulo no implementado todavia."
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
