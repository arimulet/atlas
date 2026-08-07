import { z } from "zod";

export const clubParamsSchema = z.object({
  clubId: z.string().min(1)
});

const manualRecordSchema = z.object({
  key: z.string(),
  value: z.string()
});

export const updateClubProfileBodySchema = z
  .object({
    manual: z
      .object({
        name: z.string().nullable().optional(),
        currency: z.string().nullable().optional(),
        season: z.number().int().nullable().optional(),
        week: z.number().int().nullable().optional(),
        assumptions: z.array(manualRecordSchema).optional(),
        preferences: z.array(manualRecordSchema).optional()
      })
      .optional()
  })
  .default({});

export const updateClubOperatingSettingsBodySchema = z
  .object({
    manual: z
      .object({
        currency: z.string().nullable().optional(),
        season: z.number().int().nullable().optional(),
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
