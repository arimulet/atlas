import { z } from "zod";

export const clubParamsSchema = z.object({
  clubId: z.string().min(1)
});

export const sokkerSyncRequestSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1)
});

export const sokkerMatchesImportRequestSchema = sokkerSyncRequestSchema.extend({
  clubId: z.number().int().positive()
});

const settingsRecordSchema = z.object({
  key: z.string(),
  value: z.string()
});

export const updateClubProfileBodySchema = z
  .object({
    settings: z
      .object({
        name: z.string().nullable().optional(),
        currency: z.object({ name: z.string(), rate: z.number() }).optional(),
        week: z.number().int().nullable().optional(),
        assumptions: z.array(settingsRecordSchema).optional(),
        preferences: z.array(settingsRecordSchema).optional()
      })
      .optional()
  })
  .default({});

export const updateClubOperatingSettingsBodySchema = z
  .object({
    settings: z
      .object({
        currency: z.object({ name: z.string(), rate: z.number() }).optional(),
        week: z.number().int().nullable().optional(),
        preferences: z
          .object({
            "economy.riskTolerance": z
              .enum(["conservative", "balanced", "aggressive"])
              .nullable()
              .optional(),
            "training.priority": z
              .enum(["performance", "balanced", "development"])
              .nullable()
              .optional(),
            "academy.investment": z
              .enum(["minimal", "balanced", "ambitious"])
              .nullable()
              .optional(),
            "market.strategy": z
              .enum(["conservative", "balanced", "opportunistic"])
              .nullable()
              .optional()
          })
          .optional()
      })
      .optional()
  })
  .default({});

export const compareClubSnapshotsBodySchema = z
  .object({
    baseSnapshotId: z.string().min(1).optional(),
    targetSnapshotId: z.string().min(1).optional(),
    baseSnapshotDate: z.string().min(1).optional(),
    targetSnapshotDate: z.string().min(1).optional()
  })
  .default({});
