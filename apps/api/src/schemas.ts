import { z } from "zod";

export const clubParamsSchema = z.object({
  clubId: z.string().min(1)
});

export const playerDevelopmentTargetParamsSchema = clubParamsSchema.extend({
  playerId: z.coerce.number().int().positive()
});

export const playerDevelopmentTargetBodySchema = z
  .object({
    profile: z
      .enum([
        "goalkeeper",
        "central_defender",
        "wing_defender",
        "central_midfielder",
        "winger",
        "forward"
      ])
      .nullable()
      .optional(),
    targetLevels: z
      .record(
        z.enum([
          "stamina",
          "pace",
          "technique",
          "passing",
          "keeper",
          "defender",
          "playmaker",
          "striker"
        ]),
        z.number().int().min(1).max(18)
      )
      .optional(),
    targetAge: z.number().int().min(1).nullable().optional()
  })
  .strict();

export const squadRoleAssignmentBodySchema = z
  .object({
    role: z.enum(["core", "developing", "prospect", "rotation", "depth", "transition"])
  })
  .strict();

export const sokkerSyncRequestSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1)
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
