import { z } from "zod";

export const sokkerPlayerXmlSchema = z.object({
  playerID: z.coerce.number(),
  name: z.string(),
  surname: z.string().optional(),
  age: z.coerce.number(),
  value: z.coerce.number(),
  wage: z.coerce.number(),
  form: z.coerce.number().optional(),
  stamina: z.coerce.number().optional(),
  pace: z.coerce.number().optional(),
  technique: z.coerce.number().optional(),
  passing: z.coerce.number().optional(),
  keeper: z.coerce.number().optional(),
  defender: z.coerce.number().optional(),
  playmaker: z.coerce.number().optional(),
  striker: z.coerce.number().optional()
}).passthrough();

export const sokkerPlayersXmlSchema = z.object({
  players: z.object({
    player: z.array(sokkerPlayerXmlSchema).or(sokkerPlayerXmlSchema).optional().default([])
  }).passthrough()
});

export type SokkerPlayerXml = z.infer<typeof sokkerPlayerXmlSchema>;
export type SokkerPlayersXml = z.infer<typeof sokkerPlayersXmlSchema>;
