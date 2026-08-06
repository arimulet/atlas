import { validatePlayerSnapshotV0, type PlayerSnapshotValidationResult } from "@atlas/contracts";

export * from "./importPlayerSnapshot.js";
export * from "./generateBasicDiagnostic.js";
export * from "./generateClubHistoricalFindings.js";
export * from "./importPlayerSnapshotMvp.js";
export * from "./compareClubSnapshots.js";
export * from "./calculateClubHistoricalTrends.js";
export * from "./getClubProfile.js";
export * from "./updateClubProfile.js";
export * from "./clubOperatingSettings.js";
export * from "./getClubDashboard.js";
export * from "./getSquadEconomy.js";
export * from "./getPlayerDevelopment.js";
export * from "./getSquadMarketPlanning.js";

export interface ValidatePlayerSnapshotInput {
  payload: unknown;
}

export function validatePlayerSnapshotImport(
  input: ValidatePlayerSnapshotInput
): PlayerSnapshotValidationResult {
  return validatePlayerSnapshotV0(input.payload);
}
