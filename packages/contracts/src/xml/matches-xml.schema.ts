import { z } from "zod";
import { sokkerBoolean, sokkerNumber } from "./utils.js";

const sokkerMatchXmlSchema = z
  .object({
    matchID: sokkerNumber,
    homeTeamID: sokkerNumber,
    awayTeamID: sokkerNumber,
    homeTeamName: z.string(),
    awayTeamName: z.string(),
    leagueID: sokkerNumber,
    week: sokkerNumber,
    dateExpected: z.string(),
    dateStarted: z.string().optional(),
    homeTeamScore: sokkerNumber,
    awayTeamScore: sokkerNumber,
    isFinished: sokkerBoolean
  })
  .passthrough();

export const sokkerMatchesXmlSchema = z.object({
  matches: z
    .object({
      "@_teamID": sokkerNumber.optional(),
      match: z.array(sokkerMatchXmlSchema).or(sokkerMatchXmlSchema).optional().default([])
    })
    .passthrough()
});

export type SokkerMatchXml = z.infer<typeof sokkerMatchXmlSchema>;
export type SokkerMatchesXml = z.infer<typeof sokkerMatchesXmlSchema>;
