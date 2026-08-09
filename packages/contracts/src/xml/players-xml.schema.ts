import { z } from "zod";
import { sokkerNumber } from "./utils.js";

export const sokkerPlayerXmlSchema = z.object({
  ID: sokkerNumber,
  name: z.string(),
  surname: z.string().optional(),
  age: sokkerNumber,
  value: sokkerNumber,
  wage: sokkerNumber,
  skillForm: sokkerNumber.optional(),
  skillStamina: sokkerNumber.optional(),
  skillPace: sokkerNumber.optional(),
  skillTechnique: sokkerNumber.optional(),
  skillPassing: sokkerNumber.optional(),
  skillKeeper: sokkerNumber.optional(),
  skillDefending: sokkerNumber.optional(),
  skillPlaymaking: sokkerNumber.optional(),
  skillScoring: sokkerNumber.optional()
}).passthrough();

export const sokkerPlayersXmlSchema = z.object({
  players: z.object({
    player: z.array(sokkerPlayerXmlSchema).or(sokkerPlayerXmlSchema).optional().default([])
  }).passthrough()
});

export type SokkerPlayerXml = z.infer<typeof sokkerPlayerXmlSchema>;
export type SokkerPlayersXml = z.infer<typeof sokkerPlayersXmlSchema>;
