import {
  MongoClubRepository,
  MongoSnapshotRepository,
  type PersistedPlayerSnapshot
} from "@atlas/database";
import type { BasicDiagnostic } from "@atlas/domain";
import { generateBasicDiagnosticForSnapshot } from "./generateBasicDiagnostic.js";
import {
  importPlayerSnapshot,
  type ImportPlayerSnapshotInput,
  type ImportPlayerSnapshotResult
} from "./importPlayerSnapshot.js";

export interface ImportedSquadSummary {
  playerCount: number;
  snapshotDate: string;
  club: string;
  totalEstimatedValue: {
    amount: number;
    currency: string | null;
    isComplete: boolean;
  };
  totalWage: {
    amount: number;
    currency: string | null;
    isComplete: boolean;
  };
  incompletePlayerCount: number;
}

export interface ImportPlayerSnapshotMvpResult {
  importResult: ImportPlayerSnapshotResult;
  summary: ImportedSquadSummary | null;
  diagnostic: BasicDiagnostic | null;
}

const clubRepository = new MongoClubRepository();
const snapshotRepository = new MongoSnapshotRepository();

export async function importPlayerSnapshotMvp(
  input: ImportPlayerSnapshotInput
): Promise<ImportPlayerSnapshotMvpResult> {
  const importResult = await importPlayerSnapshot(input);

  if (importResult.status === "rejected" || !importResult.snapshotId) {
    return {
      importResult,
      summary: null,
      diagnostic: null
    };
  }

  const [snapshot, diagnostic] = await Promise.all([
    snapshotRepository.findById(importResult.snapshotId),
    generateBasicDiagnosticForSnapshot({ snapshotId: importResult.snapshotId })
  ]);

  if (!snapshot) {
    throw new Error(`Imported snapshot not found: ${importResult.snapshotId}`);
  }

  const club = await clubRepository.findById(snapshot.clubId);

  return {
    importResult,
    summary: {
      playerCount: snapshot.players.length,
      snapshotDate: snapshot.snapshotDate.toISOString().slice(0, 10),
      club: club?.name ?? "Unknown club",
      totalEstimatedValue: sumMoney(snapshot.players, "estimatedValue"),
      totalWage: sumMoney(snapshot.players, "wage"),
      incompletePlayerCount: snapshot.players.filter(hasIncompleteData).length
    },
    diagnostic
  };
}

function sumMoney(
  players: PersistedPlayerSnapshot[],
  field: "estimatedValue" | "wage"
): ImportedSquadSummary["totalEstimatedValue"] {
  const currencies = new Set(players.map((player) => player[field].currency).filter(Boolean));

  return {
    amount: players.reduce((total, player) => total + player[field].amount, 0),
    currency: currencies.size === 1 ? ([...currencies][0] ?? null) : null,
    isComplete: players.every((player) => player[field].currency !== null) && currencies.size <= 1
  };
}

function hasIncompleteData(player: PersistedPlayerSnapshot): boolean {
  return (
    !player.externalId ||
    player.form === null ||
    player.availabilityStatus === null ||
    !player.observedPosition ||
    !player.wage.currency ||
    !player.estimatedValue.currency ||
    Object.values(player.skills).some((skill) => skill === null)
  );
}
