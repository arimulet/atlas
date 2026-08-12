import { z } from "zod";

export const PLAYER_SNAPSHOT_SCHEMA_VERSION = "atlas.player-snapshot.v0" as const;

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

const nullableString = z.string().min(1).nullable().optional();

export const skillSetSchema = z.object({
  stamina: z.number().finite().nonnegative().nullable().optional(),
  pace: z.number().finite().nonnegative().nullable().optional(),
  technique: z.number().finite().nonnegative().nullable().optional(),
  passing: z.number().finite().nonnegative().nullable().optional(),
  keeper: z.number().finite().nonnegative().nullable().optional(),
  defender: z.number().finite().nonnegative().nullable().optional(),
  playmaker: z.number().finite().nonnegative().nullable().optional(),
  striker: z.number().finite().nonnegative().nullable().optional()
});

export const playerSnapshotV0Schema = z.object({
  schemaVersion: z.literal(PLAYER_SNAPSHOT_SCHEMA_VERSION),
  source: z.object({
    type: z.literal("sokker-dom-export"),
    exportedAt: z.string().datetime(),
    pageUrl: z.string().url().nullable().optional(),
    locale: nullableString
  }),
  club: z.object({
    externalId: nullableString,
    name: z.string().min(1)
  }),
  snapshot: z.object({
    snapshotDate: z.string().regex(isoDate),
    gameWeek: z.number().int().positive().nullable().optional(),
    week: z.number().int().positive().nullable().optional()
  }),
  players: z.array(
    z.object({
      playerId: z.number().int().positive(),
      name: z.string().min(1),
      age: z.number().int().positive(),
      wage: z.number().finite().nonnegative(),
      value: z.number().finite().nonnegative(),
      form: z.number().finite().nonnegative().nullable().optional(),
      availabilityStatus: z
        .enum(["available", "injured", "suspended", "unknown"])
        .nullable()
        .optional(),
      observedPosition: nullableString,
      skills: skillSetSchema
    })
  )
});

export type PlayerSnapshotV0 = z.infer<typeof playerSnapshotV0Schema>;

export interface ImportIssue {
  path: string;
  message: string;
}

export type PlayerSnapshotValidationResult =
  | {
      status: "accepted";
      data: PlayerSnapshotV0;
      errors: [];
      warnings: [];
    }
  | {
      status: "accepted-with-warnings";
      data: PlayerSnapshotV0;
      errors: [];
      warnings: ImportIssue[];
    }
  | {
      status: "rejected";
      data: null;
      errors: ImportIssue[];
      warnings: [];
    };

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

export function validatePlayerSnapshotV0(input: unknown): PlayerSnapshotValidationResult {
  const parsed = playerSnapshotV0Schema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "rejected",
      data: null,
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      })),
      warnings: []
    };
  }

  const warnings = collectWarnings(parsed.data);

  if (warnings.length > 0) {
    return {
      status: "accepted-with-warnings",
      data: parsed.data,
      errors: [],
      warnings
    };
  }

  return {
    status: "accepted",
    data: parsed.data,
    errors: [],
    warnings: []
  };
}

function collectWarnings(snapshot: PlayerSnapshotV0): ImportIssue[] {
  const warnings: ImportIssue[] = [];

  snapshot.players.forEach((player, index) => {
    const prefix = `players.${index}`;

    if (player.form === undefined || player.form === null) {
      warnings.push({ path: `${prefix}.form`, message: "Missing form; current performance context is incomplete." });
    }

    if (!player.availabilityStatus) {
      warnings.push({
        path: `${prefix}.availabilityStatus`,
        message: "Missing availabilityStatus; operational risk may be unknown."
      });
    }

    if (!player.observedPosition) {
      warnings.push({
        path: `${prefix}.observedPosition`,
        message: "Missing observedPosition; role analysis may depend on assumptions."
      });
    }

    skillKeys.forEach((skill) => {
      if (player.skills[skill] === undefined || player.skills[skill] === null) {
        warnings.push({
          path: `${prefix}.skills.${skill}`,
          message: `Missing ${skill} skill; related inference confidence may be lower.`
        });
      }
    });
  });

  return warnings;
}
