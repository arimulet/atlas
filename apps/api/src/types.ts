import { z } from "zod";
import { clubParamsSchema } from "./schemas";

export type ClubParams = z.infer<typeof clubParamsSchema>;
