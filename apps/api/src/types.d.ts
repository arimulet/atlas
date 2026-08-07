import { z } from "zod";
import { clubParamsSchema } from "./http-schemas.js";

export type ClubParams = z.infer<typeof clubParamsSchema>;
