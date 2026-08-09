import { z } from "zod";

export const PLAYER_SNAPSHOT_SCHEMA_VERSION = "atlas.player-snapshot.v0";


const isoDate = /^\d{4}-\d{2}-\d{2}$/;

const nullableString = z.string().min(1).nullable().optional();

export const moneySchema = z.object({
  amount: z.number().finite().nonnegative(),
  currency: z.string().min(1).nullable().optional()
});

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
    type: z.enum(["sokker-dom-export", "sokker-xml-import"]),
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
    season: z.number().int().positive().nullable().optional(),
    week: z.number().int().positive().nullable().optional()
  }),
  players: z.array(
    z.object({
      externalId: nullableString,
      name: z.string().min(1),
      age: z.number().int().positive(),
      wage: moneySchema,
      estimatedValue: moneySchema,
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