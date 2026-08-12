import { playerSnapshotV0Schema } from "./schemas";

export { observedPositionSchema, playerRoleSchema } from "./roles.js";
export type { ObservedPosition, PlayerRole } from "./roles.js";
import { ImportIssue, PlayerSnapshotV0, PlayerSnapshotValidationResult } from "./types";

const skillKeys = [
  "stamina",
  "pace",
  "technique",
  "passing",
  "keeper",
  "defender",
  "playmaker",
  "striker"
] as const;

export const validatePlayerSnapshotV0 = (input: unknown): PlayerSnapshotValidationResult => {
  const parsed = playerSnapshotV0Schema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "rejected",
      data: null,
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      })),
      warnings: []
    };
  }

  const warnings = collectWarnings(parsed.data);

  if (warnings.length > 0) {
    return {
      status: "accepted-with-warnings",
      data: parsed.data,
      errors: [],
      warnings
    };
  }

  return {
    status: "accepted",
    data: parsed.data,
    errors: [],
    warnings: []
  };
};

function collectWarnings(snapshot: PlayerSnapshotV0): ImportIssue[] {
  const warnings: ImportIssue[] = [];

  snapshot.players.forEach((player, index) => {
    const prefix = `players.${index}`;

    if (player.form === undefined || player.form === null) {
      warnings.push({
        path: `${prefix}.form`,
        message: "Missing form; current performance context is incomplete."
      });
    }

    if (!player.availabilityStatus) {
      warnings.push({
        path: `${prefix}.availabilityStatus`,
        message: "Missing availabilityStatus; operational risk may be unknown."
      });
    }

    if (!player.observedPosition) {
      warnings.push({
        path: `${prefix}.observedPosition`,
        message: "Missing observedPosition; role analysis may depend on assumptions."
      });
    }

    skillKeys.forEach((skill) => {
      if (player.skills[skill] === undefined || player.skills[skill] === null) {
        warnings.push({
          path: `${prefix}.skills.${skill}`,
          message: `Missing ${skill} skill; related inference confidence may be lower.`
        });
      }
    });
  });

  return warnings;
}
