import {
  PlayerSnapshotValidationResult,
  validatePlayerSnapshotV0,
  type ImportIssue,
  type PlayerSnapshotV0
} from "@atlas/contracts";
import {
  MongoClubRepository,
  MongoImportEventRepository,
  MongoPlayerRepository,
  MongoSnapshotRepository,
  PersistedPlayerSnapshot,
  MongoCountryRepository
} from "@atlas/database";
import {
  BasicDiagnostic,
  BasicDiagnosticPlayerSnapshot,
  generateBasicDiagnostic,
  inferPlayerRoleFromSkills
} from "@atlas/domain";
import type { ObservedPosition } from "@atlas/domain";
import {
  GenerateBasicDiagnosticInput,
  ImportPlayerSnapshotInput,
  ImportPlayerSnapshotMvpResult,
  ImportPlayerSnapshotResult,
  NormalizedPlayerSnapshot,
  ValidatePlayerSnapshotInput
} from "./types";
import { Money, SkillKey } from "../types";

const skillKeys: SkillKey[] = [
  "stamina",
  "pace",
  "technique",
  "passing",
  "keeper",
  "defender",
  "playmaker",
  "striker"
];

const clubRepository = new MongoClubRepository();
const importEventRepository = new MongoImportEventRepository();
const playerRepository = new MongoPlayerRepository();
const snapshotRepository = new MongoSnapshotRepository();
const countryRepository = new MongoCountryRepository();

export const importPlayerSnapshot = async (
  input: ImportPlayerSnapshotInput
): Promise<ImportPlayerSnapshotResult> => {
  const validation = validatePlayerSnapshotV0(input.payload);

  if (validation.status === "rejected") {
    const importEvent = await importEventRepository.create({
      schemaVersion: readStringProperty(input.payload, "schemaVersion"),
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
    status,
    errors: validation.errors,
    warnings
  });

  const country = await countryRepository.getById(normalized.club.country);
  const currency = country
    ? { name: country.currencyName, rate: country.currencyRate }
    : { name: "UNK", rate: 1 };

  const club = await clubRepository.save({
    ...normalized.club,
    currency
  });
  const players = await Promise.all(
    normalized.players.map((player) =>
      playerRepository.resolveHistoricalIdentity({
        playerId: player.playerId,
        clubId: normalized.club.clubId,
        name: player.name
      })
    )
  );

  const history = await snapshotRepository.listByClub(club.id);
  const previousSnapshot = history.at(-1);

  if (previousSnapshot) {
    for (const junior of normalized.juniors) {
      const previousJunior = previousSnapshot.juniors.find(
        (snapshotJunior) =>
          snapshotJunior.playerId === junior.playerId || snapshotJunior.name === junior.name
      );

      if (previousJunior?.initialLevel != null) {
        junior.initialLevel = previousJunior.initialLevel;
      }
      if (previousJunior?.initialWeeksRemaining != null) {
        junior.initialWeeksRemaining = previousJunior.initialWeeksRemaining;
      }
    }
  }

  const snapshot = await snapshotRepository.save({
    clubId: club.id,
    schemaVersion: normalized.schemaVersion,
    snapshotDate: normalized.snapshot.snapshotDate,
    gameWeek: normalized.snapshot.gameWeek,
    week: normalized.snapshot.week,
    importedAt: importEvent.importedAt,
    players: normalized.players.map((player) => ({
      playerId: player.playerId,
      name: player.name,
      age: player.age,
      wage: player.wage,
      value: player.value,
      form: player.form,
      availabilityStatus: player.availabilityStatus ?? null,
      observedPosition: player.observedPosition,
      skills: player.skills,

      training: player.training
    })),
    juniors: normalized.juniors
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
    playerIds: players.flatMap((player) => (player ? [player.id] : [])),
    importedPlayerCount: players.length
  };
};

export const importPlayerSnapshotMvp = async (
  input: ImportPlayerSnapshotInput
): Promise<ImportPlayerSnapshotMvpResult> => {
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
      currency: club?.settings.currency ?? { name: "UNK", rate: 1 },
      totalValue: sumMoney(snapshot.players, "value", club?.settings.currency.name ?? "UNK"),
      totalWage: sumMoney(snapshot.players, "wage", club?.settings.currency.name ?? "UNK"),
      incompletePlayerCount: snapshot.players.filter(hasIncompleteData).length
    },
    diagnostic
  };
};

export const validatePlayerSnapshotImport = (
  input: ValidatePlayerSnapshotInput
): PlayerSnapshotValidationResult => {
  return validatePlayerSnapshotV0(input.payload);
};

async function generateBasicDiagnosticForSnapshot(
  input: GenerateBasicDiagnosticInput
): Promise<BasicDiagnostic> {
  const snapshot = await snapshotRepository.findById(input.snapshotId);

  if (!snapshot) {
    throw new Error(`Snapshot not found: ${input.snapshotId}`);
  }

  return generateBasicDiagnostic(
    {
      id: snapshot.id,
      players: snapshot.players.map(mapPlayerSnapshot)
    },
    input.generatedAt
  );
}

function mapPlayerSnapshot(player: PersistedPlayerSnapshot): BasicDiagnosticPlayerSnapshot {
  return {
    id: player.id,
    playerId: player.playerId,
    name: player.name,
    age: player.age,
    wage: { amount: player.wage, currency: null },
    value: { amount: player.value, currency: null },
    form: player.form,
    availabilityStatus: player.availabilityStatus,
    observedPosition: player.observedPosition,
    skills: player.skills
  };
}

function sumMoney(
  players: PersistedPlayerSnapshot[],
  field: "value" | "wage",
  currency: string
): Money {
  return {
    amount: players.reduce((total, player) => total + player[field], 0),
    currency,
    isComplete: players.every((player) => player[field] > 0)
  };
}

function hasIncompleteData(player: PersistedPlayerSnapshot): boolean {
  return (
    player.form === null ||
    player.availabilityStatus === null ||
    !player.observedPosition ||
    Object.values(player.skills).some((skill) => skill === null)
  );
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
      clubId: snapshot.club.clubId,
      country: snapshot.club.country,
      training: snapshot.club.training
        ? {
            GK: snapshot.club.training.gk ?? null,
            DEF: snapshot.club.training.def ?? null,
            MID: snapshot.club.training.mid ?? null,
            ATT: snapshot.club.training.att ?? null
          }
        : undefined,
      name: snapshot.club.name.trim(),
      gameWeek: snapshot.snapshot.gameWeek ?? snapshot.club.gameWeek ?? undefined,
      week: snapshot.snapshot.week ?? null,
      lastSnapshotDate: new Date(`${snapshot.snapshot.snapshotDate}T00:00:00.000Z`),
      observedAt: new Date(`${snapshot.snapshot.snapshotDate}T00:00:00.000Z`)
    },
    snapshot: {
      snapshotDate: new Date(`${snapshot.snapshot.snapshotDate}T00:00:00.000Z`),
      gameWeek: snapshot.snapshot.gameWeek ?? null,
      week: snapshot.snapshot.week ?? null
    },
    players: snapshot.players.map(normalizePlayer),
    juniors: (snapshot.juniors ?? []).map((junior) => ({
      playerId: junior.playerId,
      name: junior.name.trim(),
      age: junior.age,
      initialLevel: junior.skill ?? 0,
      initialWeeksRemaining: junior.initialWeeksRemaining ?? junior.weeksRemaining ?? null,
      weeksRemaining: junior.weeksRemaining ?? null,
      skill: junior.skill ?? 0,
      status: junior.status ?? "in_academy"
    }))
  };
}

function normalizePlayer(
  player: PlayerSnapshotV0["players"][number]
): NormalizedPlayerSnapshot["players"][number] {
  const skills = normalizeSkills(player.skills);
  // External snapshots may omit the observed role; derive it consistently from skills.
  const observedPosition = deriveObservedPosition(skills);

  return {
    playerId: player.playerId,
    name: player.name.trim(),
    age: player.age,
    wage: player.wage,
    value: player.value,
    training: {
      position: player.training.position,
      advanced: player.training.advanced
    },
    form: player.form ?? null,
    availabilityStatus: player.availabilityStatus ?? null,
    observedPosition,
    skills
  };
}

function normalizeSkills(skills: PlayerSnapshotV0["players"][number]["skills"]) {
  return Object.fromEntries(
    skillKeys.map((skill: SkillKey) => [skill, skills[skill] ?? null])
  ) as Record<SkillKey, number | null>;
}

function deriveObservedPosition(skills: Record<SkillKey, number | null>): ObservedPosition | null {
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

export * from "./types.js";
