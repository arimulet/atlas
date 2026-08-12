import { z } from "zod";

export const playerRoleSchema = z.enum([
  "goalkeeper",
  "defender",
  "midfielder",
  "winger",
  "striker",
  "trainee",
  "undefined"
]);

export const observedPositionSchema = playerRoleSchema.exclude(["trainee", "undefined"]);

export type PlayerRole = z.infer<typeof playerRoleSchema>;
export type ObservedPosition = z.infer<typeof observedPositionSchema>;
