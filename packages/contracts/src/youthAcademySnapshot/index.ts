import { youthAcademySnapshotV0Schema } from "./schemas.js";
import type { YouthAcademySnapshotValidationResult, YouthAcademySnapshotV0 } from "./types.js";
import type { ImportIssue } from "../playerSnapshot/types.js";

export const validateYouthAcademySnapshotV0 = (
  input: unknown
): YouthAcademySnapshotValidationResult => {
  const parsed = youthAcademySnapshotV0Schema.safeParse(input);

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

function collectWarnings(snapshot: YouthAcademySnapshotV0): ImportIssue[] {
  const warnings: ImportIssue[] = [];

  if (snapshot.academy.weeklyInvestment && !snapshot.academy.weeklyInvestment.currency) {
    warnings.push({
      path: "academy.weeklyInvestment.currency",
      message: "Missing weekly investment currency."
    });
  }

  snapshot.academy.players.forEach((player, index) => {
    const prefix = `academy.players.${index}`;

    if (!player.externalId) {
      warnings.push({
        path: `${prefix}.externalId`,
        message: "Missing externalId; youth player identity may require manual review."
      });
    }

    if (player.weeksInAcademy === undefined || player.weeksInAcademy === null) {
      warnings.push({
        path: `${prefix}.weeksInAcademy`,
        message: "Missing weeksInAcademy; development time in academy is unknown."
      });
    }

    if (player.weeksRemaining === undefined || player.weeksRemaining === null) {
      warnings.push({
        path: `${prefix}.weeksRemaining`,
        message: "Missing weeksRemaining; promotion timeline is unknown."
      });
    }

    if (!player.estimatedLevel) {
      warnings.push({
        path: `${prefix}.estimatedLevel`,
        message: "Missing estimatedLevel; potential talent assessment confidence is lower."
      });
    }

    if (!player.status) {
      warnings.push({
        path: `${prefix}.status`,
        message: "Missing status; defaulting to in_academy."
      });
    }
  });

  return warnings;
}

export * from "./schemas.js";
export * from "./types.js";
