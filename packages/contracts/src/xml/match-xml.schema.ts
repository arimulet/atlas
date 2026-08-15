import { z } from "zod";
import { sokkerNumber } from "./utils.js";

const sokkerPlayerStatsXmlSchema = z
  .object({
    playerID: sokkerNumber,
    number: sokkerNumber,
    formation: sokkerNumber,
    timeIn: sokkerNumber,
    timeOut: sokkerNumber,
    rating: sokkerNumber.optional(),
    timePlaying: sokkerNumber.optional(),
    timeDefending: sokkerNumber.optional()
  })
  .passthrough();

const sokkerPlayersStatsXmlSchema = z
  .object({
    "@_teamID": sokkerNumber,
    playerStats: z.array(sokkerPlayerStatsXmlSchema).or(sokkerPlayerStatsXmlSchema)
  })
  .passthrough();

export const sokkerMatchXmlSchema = z.object({
  match: z
    .object({
      playersStats: z
        .array(sokkerPlayersStatsXmlSchema)
        .or(sokkerPlayersStatsXmlSchema)
        .optional()
        .default([])
    })
    .passthrough()
});

export type SokkerPlayerStatsXml = z.infer<typeof sokkerPlayerStatsXmlSchema>;
export type SokkerPlayersStatsXml = z.infer<typeof sokkerPlayersStatsXmlSchema>;
export type SokkerMatchDetailXml = z.infer<typeof sokkerMatchXmlSchema>;
