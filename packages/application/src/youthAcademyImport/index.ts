import {
  validateYouthAcademySnapshotV0,
  type YouthAcademySnapshotV0,
  type YouthAcademySnapshotValidationResult
} from "@atlas/contracts";
import {
  MongoClubRepository,
  MongoImportEventRepository,
  MongoYouthSnapshotRepository
} from "@atlas/database";
import type {
  ImportYouthAcademySnapshotInput,
  ImportYouthAcademySnapshotResult,
  NormalizedYouthAcademySnapshot,
  ValidateYouthAcademySnapshotInput
} from "./types.js";

const clubRepository = new MongoClubRepository();
const importEventRepository = new MongoImportEventRepository();
const youthSnapshotRepository = new MongoYouthSnapshotRepository();

export const importYouthAcademySnapshot = async (
  input: ImportYouthAcademySnapshotInput
): Promise<ImportYouthAcademySnapshotResult> => {
  const validation = validateYouthAcademySnapshotV0(input.payload);

  if (validation.status === "rejected") {
    const importEvent = await importEventRepository.create({
      schemaVersion: readStringProperty(input.payload, "schemaVersion"),
      sourceType: readNestedStringProperty(input.payload, ["source", "type"]),
      status: validation.status,
      errors: validation.errors,
      warnings: validation.warnings
    });

    return {
      status: validation.status,
      errors: validation.errors,
      warnings: validation.warnings,
      importEventId: importEvent.id,
      snapshotId: null,
      clubId: null,
      importedPlayerCount: 0
    };
  }

  const normalized = normalizeYouthAcademySnapshot(validation.data);
  const warnings = validation.warnings;
  const status = warnings.length > 0 ? "accepted-with-warnings" : "accepted";

  const importEvent = await importEventRepository.create({
    schemaVersion: normalized.schemaVersion,
    sourceType: normalized.source.type,
    status,
    errors: validation.errors,
    warnings
  });

  const club = await clubRepository.save(normalized.club);

  const snapshot = await youthSnapshotRepository.save({
    clubId: club.id,
    schemaVersion: normalized.schemaVersion,
    snapshotDate: normalized.snapshot.snapshotDate,
    season: normalized.snapshot.season,
    week: normalized.snapshot.week,
    importedAt: importEvent.importedAt,
    source: normalized.source,
    weeklyInvestment: normalized.academy.weeklyInvestment,
    players: normalized.academy.players
  });

  await importEventRepository.attachResult(importEvent.id, {
    clubId: club.id,
    snapshotId: snapshot.id
  });

  return {
    status,
    errors: validation.errors,
    warnings,
    importEventId: importEvent.id,
    snapshotId: snapshot.id,
    clubId: club.id,
    importedPlayerCount: snapshot.players.length
  };
};

export const validateYouthAcademySnapshotImport = (
  input: ValidateYouthAcademySnapshotInput
): YouthAcademySnapshotValidationResult => {
  return validateYouthAcademySnapshotV0(input.payload);
};

function normalizeYouthAcademySnapshot(
  snapshot: YouthAcademySnapshotV0
): NormalizedYouthAcademySnapshot {
  return {
    schemaVersion: snapshot.schemaVersion,
    source: {
      type: snapshot.source.type,
      exportedAt: new Date(snapshot.source.exportedAt),
      pageUrl: normalizeOptionalString(snapshot.source.pageUrl),
      locale: normalizeOptionalString(snapshot.source.locale)
    },
    club: {
      externalId: normalizeOptionalString(snapshot.club.externalId),
      name: snapshot.club.name.trim(),
      season: snapshot.snapshot.season ?? null,
      week: snapshot.snapshot.week ?? null,
      lastSnapshotDate: new Date(`${snapshot.snapshot.snapshotDate}T00:00:00.000Z`),
      sourceType: snapshot.source.type,
      observedAt: new Date(snapshot.source.exportedAt)
    },
    snapshot: {
      snapshotDate: new Date(`${snapshot.snapshot.snapshotDate}T00:00:00.000Z`),
      season: snapshot.snapshot.season ?? null,
      week: snapshot.snapshot.week ?? null
    },
    academy: {
      weeklyInvestment: snapshot.academy.weeklyInvestment
        ? {
            amount: snapshot.academy.weeklyInvestment.amount,
            currency: normalizeOptionalString(snapshot.academy.weeklyInvestment.currency)
          }
        : null,
      players: snapshot.academy.players.map((player) => ({
        externalId: normalizeOptionalString(player.externalId),
        name: player.name.trim(),
        age: player.age,
        weeksInAcademy: player.weeksInAcademy ?? null,
        weeksRemaining: player.weeksRemaining ?? null,
        estimatedLevel: player.estimatedLevel ? player.estimatedLevel.trim() : null,
        status: player.status ?? "in_academy"
      }))
    }
  };
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function readStringProperty(input: unknown, property: string): string | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const value = (input as Record<string, unknown>)[property];
  return typeof value === "string" ? value : null;
}

function readNestedStringProperty(input: unknown, path: string[]): string | null {
  let current: unknown = input;

  for (const part of path) {
    if (!current || typeof current !== "object") {
      return null;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === "string" ? current : null;
}

export * from "./types.js";
