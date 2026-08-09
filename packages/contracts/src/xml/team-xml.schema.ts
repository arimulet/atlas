import { z } from "zod";

export const sokkerTeamXmlSchema = z.object({
  team: z.object({
    teamID: z.coerce.number(),
    name: z.string(),
    countryID: z.coerce.number(),
    money: z.coerce.number(),
    // We assume these might be present or can be inferred
    season: z.coerce.number().optional(),
    week: z.coerce.number().optional()
  }).passthrough()
});

export type SokkerTeamXml = z.infer<typeof sokkerTeamXmlSchema>;
