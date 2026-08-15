import { z } from "zod";
import { sokkerBoolean, sokkerNumber } from "./utils.js";

export const sokkerLeagueXmlSchema = z.object({
  league: z.object({
    info: z
      .object({
        leagueID: sokkerNumber,
        name: z.string(),
        type: sokkerNumber,
        isOfficial: sokkerBoolean,
        isCup: sokkerBoolean.optional()
      })
      .passthrough()
  })
});

export type SokkerLeagueXml = z.infer<typeof sokkerLeagueXmlSchema>;
