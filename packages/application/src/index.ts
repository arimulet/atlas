import { validatePlayerSnapshotV0, type PlayerSnapshotValidationResult } from "@atlas/contracts";

export interface ValidatePlayerSnapshotInput {
  payload: unknown;
}

export function validatePlayerSnapshotImport(
  input: ValidatePlayerSnapshotInput
): PlayerSnapshotValidationResult {
  return validatePlayerSnapshotV0(input.payload);
}
