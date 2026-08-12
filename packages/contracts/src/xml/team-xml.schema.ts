import { z } from "zod";
import { sokkerNumber } from "./utils.js";

export const sokkerTeamXmlSchema = z.object({
  teamdata: z.object({
    team: z.object({
      teamID: sokkerNumber,
      name: z.string(),
      countryID: sokkerNumber,
      money: sokkerNumber,
      trainingTypeGk: sokkerNumber.optional(),
      trainingTypeDef: sokkerNumber.optional(),
      trainingTypeMid: sokkerNumber.optional(),
      trainingTypeAtt: sokkerNumber.optional(),
      // We assume these might be present or can be inferred
      season: sokkerNumber.optional(),
      week: sokkerNumber.optional()
    }).passthrough()
  }).passthrough()
});

export type SokkerTeamXml = z.infer<typeof sokkerTeamXmlSchema>;
