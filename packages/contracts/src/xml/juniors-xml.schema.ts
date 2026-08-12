import { z } from "zod";
import { sokkerNumber } from "./utils.js";

export const sokkerJuniorXmlSchema = z.object({
  ID: sokkerNumber,
  name: z.string(),
  surname: z.string().optional(),
  age: sokkerNumber,
  weeks: sokkerNumber,
  skill: sokkerNumber
}).passthrough();

export const sokkerJuniorsXmlSchema = z.object({
  juniors: z.object({
    junior: z.array(sokkerJuniorXmlSchema).or(sokkerJuniorXmlSchema).optional().default([])
  }).passthrough()
});

export type SokkerJuniorXml = z.infer<typeof sokkerJuniorXmlSchema>;
export type SokkerJuniorsXml = z.infer<typeof sokkerJuniorsXmlSchema>;
