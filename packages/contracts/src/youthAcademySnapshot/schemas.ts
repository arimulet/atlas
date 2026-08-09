import { z } from "zod";

export const YOUTH_ACADEMY_SNAPSHOT_SCHEMA_VERSION = "atlas.youth-academy-snapshot.v0" as const;

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

const nullableString = z.string().min(1).nullable().optional();

export const moneySchema = z.object({
  amount: z.number().finite().nonnegative(),
  currency: z.string().min(1).nullable().optional()
});

export const youthPlayerStatusSchema = z.enum(["in_academy", "ready_for_promotion", "promoted"]);

export const youthPlayerItemSchema = z.object({
  externalId: nullableString,
  name: z.string().min(1),
  age: z.number().int().positive(),
  weeksInAcademy: z.number().int().nonnegative().nullable().optional(),
  weeksRemaining: z.number().int().nonnegative().nullable().optional(),
  estimatedLevel: z
    .union([z.string().min(1), z.number().finite()])
    .transform((val) => (val == null ? null : String(val)))
    .nullable()
    .optional(),
  status: youthPlayerStatusSchema.nullable().optional()
});

export const youthAcademySnapshotV0Schema = z.object({
  schemaVersion: z.literal(YOUTH_ACADEMY_SNAPSHOT_SCHEMA_VERSION),
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
  academy: z.object({
    weeklyInvestment: moneySchema.nullable().optional(),
    players: z.array(youthPlayerItemSchema)
  })
});
