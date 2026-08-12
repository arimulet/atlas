import { z } from "zod";
import { sokkerNumber } from "./utils.js";

export const sokkerVarsXmlSchema = z.object({
  vars: z.object({
    week: sokkerNumber,
    day: sokkerNumber
  })
});

export type SokkerVarsXml = z.infer<typeof sokkerVarsXmlSchema>;
