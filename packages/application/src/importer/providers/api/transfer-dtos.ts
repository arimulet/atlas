import { z } from "zod";

export const sokkerTransferPlayerSchema = z.object({
  id: z.number(),
  info: z.object({
    name: z.object({
      full: z.string().optional()
    }).optional(),
    country: z.object({
      code: z.number().optional()
    }).optional(),
    characteristics: z.object({
      age: z.number().optional()
    }).optional(),
    skills: z.record(z.string(), z.number().nullable().optional()).optional()
  }).optional()
});

export const sokkerActiveTransferSchema = z.object({
  player: sokkerTransferPlayerSchema,
  deadline: z.any().optional(),
  price: z.any().optional()
});

export const sokkerActiveTransfersResponseSchema = z.object({
  transfers: z.array(sokkerActiveTransferSchema).optional(),
  total: z.number().optional()
});

export const sokkerHistoryTransferSchema = z.object({
  id: z.number().optional(),
  date: z.any().optional(),
  price: z.any().optional(),
  player: z.object({
    id: z.number(),
    info: z.object({
      name: z.object({
        full: z.string().optional()
      }).optional(),
      characteristics: z.object({
        age: z.number().optional()
      }).optional()
    }).optional()
  }).optional()
});

export const sokkerHistoryTransfersResponseSchema = z.object({
  transfers: z.array(sokkerHistoryTransferSchema).optional()
});

export const sokkerPlayerTransferHistoryItemSchema = z.object({
  playerId: z.number(),
  playerName: z.object({
    full: z.string().optional()
  }).optional(),
  date: z.object({
    value: z.string().optional(),
    timestamp: z.number().optional()
  }).optional(),
  price: z.object({
    value: z.number().optional(),
    currency: z.string().optional()
  }).optional(),
  age: z.number().optional()
});

export const sokkerPlayerTransferHistoryResponseSchema = z.object({
  transfers: z.array(sokkerPlayerTransferHistoryItemSchema).optional()
});

export type SokkerActiveTransferDto = z.infer<typeof sokkerActiveTransferSchema>;
export type SokkerHistoryTransferDto = z.infer<typeof sokkerHistoryTransferSchema>;
