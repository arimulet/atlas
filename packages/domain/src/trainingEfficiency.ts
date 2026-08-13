export type TrainingType = "formation" | "advanced";

export interface TrainingEfficiencyInput {
  officialMinutes: number;
  friendlyMinutes: number;
  advancedTraining: boolean;
}

export interface TrainingEfficiencyResult {
  equivalentMinutes: number;
  formationEfficiency: number;
  trainingEfficiency: number;
  trainingType: TrainingType;
}

const FRIENDLY_MATCH_WEIGHT = 0.75;
const FIRST_EFFICIENCY_THRESHOLD = 90;
const MAX_EQUIVALENT_MINUTES = 180;
const FIRST_SEGMENT_EFFICIENCY = 93;
const MAX_EFFICIENCY = 100;
const ADVANCED_BASE_EFFICIENCY = 50;

export function calculateEquivalentTrainingMinutes(
  officialMinutes: number,
  friendlyMinutes: number
): number {
  assertNonNegativeFinite(officialMinutes, "officialMinutes");
  assertNonNegativeFinite(friendlyMinutes, "friendlyMinutes");

  return officialMinutes + friendlyMinutes * FRIENDLY_MATCH_WEIGHT;
}

export function calculateFormationTrainingEfficiency(equivalentMinutes: number): number {
  assertNonNegativeFinite(equivalentMinutes, "equivalentMinutes");

  if (equivalentMinutes >= MAX_EQUIVALENT_MINUTES) {
    return MAX_EFFICIENCY;
  }

  const unroundedEfficiency =
    equivalentMinutes <= FIRST_EFFICIENCY_THRESHOLD
      ? (equivalentMinutes * FIRST_SEGMENT_EFFICIENCY) / FIRST_EFFICIENCY_THRESHOLD
      : FIRST_SEGMENT_EFFICIENCY +
        (equivalentMinutes - FIRST_EFFICIENCY_THRESHOLD) *
          ((MAX_EFFICIENCY - FIRST_SEGMENT_EFFICIENCY) /
            (MAX_EQUIVALENT_MINUTES - FIRST_EFFICIENCY_THRESHOLD));

  return Math.min(MAX_EFFICIENCY, Math.round(unroundedEfficiency));
}

export function calculateAdvancedTrainingEfficiency(formationEfficiency: number): number {
  assertEfficiency(formationEfficiency, "formationEfficiency");

  return Math.min(MAX_EFFICIENCY, Math.floor(ADVANCED_BASE_EFFICIENCY + formationEfficiency / 2));
}

export function calculateTrainingEfficiency(
  input: TrainingEfficiencyInput
): TrainingEfficiencyResult {
  assertBoolean(input.advancedTraining, "advancedTraining");

  const equivalentMinutes = calculateEquivalentTrainingMinutes(
    input.officialMinutes,
    input.friendlyMinutes
  );
  const formationEfficiency = calculateFormationTrainingEfficiency(equivalentMinutes);
  const trainingType: TrainingType = input.advancedTraining ? "advanced" : "formation";
  const trainingEfficiency = input.advancedTraining
    ? calculateAdvancedTrainingEfficiency(formationEfficiency)
    : formationEfficiency;

  return {
    equivalentMinutes,
    formationEfficiency,
    trainingEfficiency,
    trainingType
  };
}

function assertNonNegativeFinite(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} must be a finite non-negative number.`);
  }
}

function assertEfficiency(value: number, fieldName: string): void {
  assertNonNegativeFinite(value, fieldName);

  if (value > MAX_EFFICIENCY) {
    throw new Error(`${fieldName} must be between 0 and ${MAX_EFFICIENCY}.`);
  }
}

function assertBoolean(value: boolean, fieldName: string): void {
  if (typeof value !== "boolean") {
    throw new Error(`${fieldName} must be a boolean.`);
  }
}
