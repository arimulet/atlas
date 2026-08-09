import { z } from "zod";

export const sokkerJuniorXmlSchema = z.object({
  juniorID: z.coerce.number(),
  name: z.string(),
  surname: z.string().optional(),
  age: z.coerce.number(),
  weeks: z.coerce.number(),
  skill: z.coerce.number()
}).passthrough();

export const sokkerJuniorsXmlSchema = z.object({
  juniors: z.object({
    junior: z.array(sokkerJuniorXmlSchema).or(sokkerJuniorXmlSchema).optional().default([])
  }).passthrough()
});

export type SokkerJuniorXml = z.infer<typeof sokkerJuniorXmlSchema>;
export type SokkerJuniorsXml = z.infer<typeof sokkerJuniorsXmlSchema>;
