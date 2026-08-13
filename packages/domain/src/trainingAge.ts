export const BASE_TRAINING_AGE = 16;
export const AGE_TRAINING_FACTOR = 1.094;

export function calculateAgeTrainingCostFactor(age: number): number {
  assertValidTrainingAge(age);

  return Math.pow(AGE_TRAINING_FACTOR, age - BASE_TRAINING_AGE);
}

export function calculateRelativeTrainingSpeed(age: number): number {
  return 1 / calculateAgeTrainingCostFactor(age);
}

function assertValidTrainingAge(age: number): void {
  if (!Number.isFinite(age) || age < BASE_TRAINING_AGE) {
    throw new Error(`age must be a finite number greater than or equal to ${BASE_TRAINING_AGE}.`);
  }
}
