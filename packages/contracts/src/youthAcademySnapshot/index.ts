import { youthAcademySnapshotV0Schema } from "./schemas.js";
import type { YouthAcademySnapshotValidationResult, YouthAcademySnapshotV0 } from "./types.js";
import type { ImportIssue } from "../playerSnapshot/types.js";

export const validateYouthAcademySnapshotV0 = (
  input: unknown
): YouthAcademySnapshotValidationResult => {
  const parsed = youthAcademySnapshotV0Schema.safeParse(input);

  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message
    }));
    const warnings = errors
      .filter((issue) => issue.path.endsWith(".skill"))
      .map((issue) => ({
        path: issue.path,
        message: "Missing skill; potential talent assessment confidence is lower."
      }));

    return {
      status: "rejected",
      data: null,
      errors,
      warnings
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

    if (player.weeksRemaining === undefined || player.weeksRemaining === null) {
      warnings.push({
        path: `${prefix}.weeksRemaining`,
        message: "Missing weeksRemaining; promotion timeline is unknown."
      });
    }


    if (player.skill === undefined || player.skill === null) {
      warnings.push({
        path: `${prefix}.skill`,
        message: "Missing skill; potential talent assessment confidence is lower."
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
