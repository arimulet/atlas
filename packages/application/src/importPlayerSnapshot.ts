import {
  validatePlayerSnapshotV0,
  type ImportIssue,
  type PlayerSnapshotV0
} from "@atlas/contracts";
import {
  MongoClubRepository,
  MongoImportEventRepository,
  MongoPlayerRepository,
  MongoSnapshotRepository
} from "@atlas/database";
import { inferPlayerRoleFromSkills } from "@atlas/domain";

export type ImportPlayerSnapshotStatus = "accepted" | "accepted-with-warnings" | "rejected";

export interface ImportPlayerSnapshotInput {
  payload: unknown;
}

export interface ImportPlayerSnapshotResult {
  status: ImportPlayerSnapshotStatus;
  errors: ImportIssue[];
  warnings: ImportIssue[];
  importEventId: string;
  snapshotId: string | null;
  clubId: string | null;
  playerIds: string[];
  importedPlayerCount: number;
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
] as const;

const clubRepository = new MongoClubRepository();
const importEventRepository = new MongoImportEventRepository();
const playerRepository = new MongoPlayerRepository();
const snapshotRepository = new MongoSnapshotRepository();

export async function importPlayerSnapshot(
  input: ImportPlayerSnapshotInput
): Promise<ImportPlayerSnapshotResult> {
  const validation = validatePlayerSnapshotV0(input.payload);

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
      playerIds: [],
      importedPlayerCount: 0
    };
  }

  const normalized = normalizePlayerSnapshot(validation.data);
  const warnings = filterResolvedWarnings(validation.warnings, normalized);
  const status = warnings.length > 0 ? "accepted-with-warnings" : "accepted";
  const importEvent = await importEventRepository.create({
    schemaVersion: normalized.schemaVersion,
    sourceType: normalized.source.type,
    status,
    errors: validation.errors,
    warnings
  });

  const club = await clubRepository.save(normalized.club);
  const players = await Promise.all(
    normalized.players.map((player) =>
      playerRepository.resolveHistoricalIdentity({
        externalId: player.externalId,
        name: player.name
      })
    )
  );
  const snapshot = await snapshotRepository.save({
    clubId: club.id,
    schemaVersion: normalized.schemaVersion,
    snapshotDate: normalized.snapshot.snapshotDate,
    season: normalized.snapshot.season,
    week: normalized.snapshot.week,
    importedAt: importEvent.importedAt,
    source: normalized.source,
    players: normalized.players.map((player, index) => ({
      playerId: players[index]?.id ?? null,
      externalId: player.externalId,
      name: player.name,
      age: player.age,
      wage: player.wage,
      estimatedValue: player.estimatedValue,
      form: player.form,
      availabilityStatus: player.availabilityStatus ?? null,
      observedPosition: player.observedPosition,
      skills: player.skills,
      roles: [] as string[]
    }))
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
    playerIds: players.map((player) => player.id),
    importedPlayerCount: players.length
  };
}

interface NormalizedPlayerSnapshot {
  schemaVersion: PlayerSnapshotV0["schemaVersion"];
  source: {
    type: PlayerSnapshotV0["source"]["type"];
    exportedAt: Date;
    pageUrl: string | null;
    locale: string | null;
  };
  club: {
    externalId: string | null;
    name: string;
  };
  snapshot: {
    snapshotDate: Date;
    season: number | null;
    week: number | null;
  };
  players: Array<{
    externalId: string | null;
    name: string;
    age: number;
    wage: { amount: number; currency: string | null };
    estimatedValue: { amount: number; currency: string | null };
    form: number | null;
    availabilityStatus: PlayerSnapshotV0["players"][number]["availabilityStatus"] | null;
    observedPosition: string | null;
    skills: Record<(typeof skillKeys)[number], number | null>;
  }>;
}

function normalizePlayerSnapshot(snapshot: PlayerSnapshotV0): NormalizedPlayerSnapshot {
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
      name: snapshot.club.name.trim()
    },
    snapshot: {
      snapshotDate: new Date(`${snapshot.snapshot.snapshotDate}T00:00:00.000Z`),
      season: snapshot.snapshot.season ?? null,
      week: snapshot.snapshot.week ?? null
    },
    players: snapshot.players.map(normalizePlayer)
  };
}

function normalizePlayer(player: PlayerSnapshotV0["players"][number]): NormalizedPlayerSnapshot["players"][number] {
  const skills = normalizeSkills(player.skills);
  const observedPosition = normalizeOptionalString(player.observedPosition) ?? deriveObservedPosition(skills);

  return {
    externalId: normalizeOptionalString(player.externalId),
    name: player.name.trim(),
    age: player.age,
    wage: {
      amount: player.wage.amount,
      currency: normalizeOptionalString(player.wage.currency)
    },
    estimatedValue: {
      amount: player.estimatedValue.amount,
      currency: normalizeOptionalString(player.estimatedValue.currency)
    },
    form: player.form ?? null,
    availabilityStatus: player.availabilityStatus ?? null,
    observedPosition,
    skills
  };
}

function normalizeSkills(skills: PlayerSnapshotV0["players"][number]["skills"]) {
  return Object.fromEntries(skillKeys.map((skill) => [skill, skills[skill] ?? null])) as Record<
    (typeof skillKeys)[number],
    number | null
  >;
}

function deriveObservedPosition(skills: Record<(typeof skillKeys)[number], number | null>): string | null {
  const inferred = inferPlayerRoleFromSkills(skills);

  return inferred.role === "undefined" ? null : inferred.role;
}

function filterResolvedWarnings(
  warnings: ImportIssue[],
  snapshot: NormalizedPlayerSnapshot
): ImportIssue[] {
  return warnings.filter((warning) => {
    const match = warning.path.match(/^players\.(\d+)\.observedPosition$/);

    if (!match?.[1]) {
      return true;
    }

    const player = snapshot.players[Number(match[1])];

    return !player?.observedPosition;
  });
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
