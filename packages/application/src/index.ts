import { validatePlayerSnapshotV0, type PlayerSnapshotValidationResult } from "@atlas/contracts";

export * from "./importPlayerSnapshot.js";
export * from "./generateBasicDiagnostic.js";
export * from "./importPlayerSnapshotMvp.js";
export * from "./compareClubSnapshots.js";
export * from "./calculateClubHistoricalTrends.js";

export interface ValidatePlayerSnapshotInput {
  payload: unknown;
}

export function validatePlayerSnapshotImport(
  input: ValidatePlayerSnapshotInput
): PlayerSnapshotValidationResult {
  return validatePlayerSnapshotV0(input.payload);
}
