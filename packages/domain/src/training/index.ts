import {
  ADVANCED_BASE_EFFICIENCY,
  AGE_TRAINING_FACTOR,
  BASE_TRAINING_AGE,
  FIRST_EFFICIENCY_THRESHOLD,
  FIRST_SEGMENT_EFFICIENCY,
  FRIENDLY_MATCH_WEIGHT,
  MAX_EFFICIENCY,
  MAX_EQUIVALENT_MINUTES,
  MAX_SKILL_LEVEL,
  MAX_TRAINING_EFFICIENCY,
  SKILL_LEVEL_TRAINING_FACTOR,
  SKILL_TRAINING_BASE_LEVEL
} from "./constants.js";
import type {
  SkillTrainingCostInput,
  SkillTrainingCostResult,
  SkillProgressObservation,
  SkillProgressObservationConfidence,
  SkillProgressObservationInput,
  SkillProgressObservationStatus,
  TrainingEfficiencyInput,
  TrainingEfficiencyResult,
  TrainingPosition,
  TrainingType
} from "./types.js";

export {
  AGE_TRAINING_FACTOR,
  BASE_TRAINING_AGE,
  MAX_SKILL_LEVEL,
  MAX_TRAINING_EFFICIENCY,
  SKILL_LEVEL_TRAINING_FACTOR,
  SKILL_TRAINING_BASE_LEVEL
} from "./constants.js";

export type {
  EffectiveTrainingCyclesSource,
  SkillTrainingCostInput,
  SkillTrainingCostResult,
  SkillTrainingCostSkill,
  SkillProgressObservation,
  SkillProgressObservationConfidence,
  SkillProgressObservationInput,
  SkillProgressObservationStatus,
  TrainingEfficiencyInput,
  TrainingEfficiencyResult,
  TrainingPosition,
  TrainingType
} from "./types.js";

export function calculateAgeTrainingCostFactor(age: number): number {
  assertValidTrainingAge(age);

  return Math.pow(AGE_TRAINING_FACTOR, age - BASE_TRAINING_AGE);
}

export function calculateRelativeTrainingSpeed(age: number): number {
  return 1 / calculateAgeTrainingCostFactor(age);
}

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

export function calculateSkillTrainingCostFactor(
  input: SkillTrainingCostInput
): SkillTrainingCostResult {
  assertSupportedSkill(input.skill);
  assertValidTargetSkillLevel(input.targetSkillLevel);

  const baseLevel = SKILL_TRAINING_BASE_LEVEL[input.skill];
  const exponent = input.targetSkillLevel - baseLevel;

  return {
    skill: input.skill,
    targetSkillLevel: input.targetSkillLevel,
    baseLevel,
    exponent,
    costFactor: Math.pow(SKILL_LEVEL_TRAINING_FACTOR, exponent)
  };
}

export function calculateSkillTrainingSpeedFactor(input: SkillTrainingCostInput): number {
  return 1 / calculateSkillTrainingCostFactor(input).costFactor;
}

export function calculateSkillProgressObservation(
  input: SkillProgressObservationInput
): SkillProgressObservation {
  assertPlayerId(input.playerId);
  assertSupportedSkill(input.skill);
  assertSkillLevel(input.fromLevel, "fromLevel");
  assertSkillLevel(input.toLevel, "toLevel");
  assertAge(input.ageAtStart, "ageAtStart");
  assertAge(input.ageAtEnd, "ageAtEnd");

  if (input.ageAtEnd < input.ageAtStart) {
    throw new Error("ageAtEnd must be greater than or equal to ageAtStart.");
  }

  assertTrainingPosition(input.assignedPosition);
  assertSnapshotId(input.startSnapshotId, "startSnapshotId");
  assertSnapshotId(input.endSnapshotId, "endSnapshotId");
  assertCalendarCycles(input.calendarCycles);

  const trainingEfficiencies = input.trainingEfficiencies;
  if (trainingEfficiencies !== undefined) {
    assertTrainingEfficiencies(trainingEfficiencies, input.calendarCycles);
  }

  if (input.toLevel < input.fromLevel) {
    throw new Error("toLevel must be greater than or equal to fromLevel.");
  }

  const levelDelta = input.toLevel - input.fromLevel;
  const hasObservedEfficiencies = trainingEfficiencies !== undefined;
  const effectiveTrainingCycles = hasObservedEfficiencies
    ? trainingEfficiencies.reduce(
        (total, efficiency) => total + efficiency / MAX_TRAINING_EFFICIENCY,
        0
      )
    : input.calendarCycles;
  const status: SkillProgressObservationStatus = levelDelta > 0 ? "progressed" : "censored";
  const calendarWeeksPerLevel = levelDelta > 0 ? input.calendarCycles / levelDelta : null;
  const effectiveWeeksPerLevel = levelDelta > 0 ? effectiveTrainingCycles / levelDelta : null;

  return {
    playerId: input.playerId,
    skill: input.skill,
    status,
    fromLevel: input.fromLevel,
    toLevel: input.toLevel,
    levelDelta,
    ageAtStart: input.ageAtStart,
    ageAtEnd: input.ageAtEnd,
    trainingType: input.trainingType,
    assignedPosition: input.assignedPosition,
    calendarCycles: input.calendarCycles,
    effectiveTrainingCycles,
    effectiveTrainingCyclesSource: hasObservedEfficiencies
      ? "observed"
      : "assumed-full-effectiveness",
    calendarWeeksPerLevel,
    effectiveWeeksPerLevel,
    startSnapshotId: input.startSnapshotId,
    endSnapshotId: input.endSnapshotId,
    confidence: calculateConfidence({
      hasObservedEfficiencies,
      levelDelta,
      trainingType: input.trainingType,
      assignedPosition: input.assignedPosition
    })
  };
}

function calculateConfidence(input: {
  hasObservedEfficiencies: boolean;
  levelDelta: number;
  trainingType: TrainingType | null;
  assignedPosition: TrainingPosition | null;
}): SkillProgressObservationConfidence {
  if (input.levelDelta === 0) {
    return "low";
  }

  if (
    input.levelDelta === 1 &&
    input.hasObservedEfficiencies &&
    input.trainingType !== null &&
    input.assignedPosition !== null
  ) {
    return "high";
  }

  if (input.levelDelta === 1) {
    return "medium";
  }

  return "low";
}

function assertPlayerId(playerId: number): void {
  if (!Number.isInteger(playerId) || playerId <= 0) {
    throw new Error("playerId must be a positive integer.");
  }
}

function assertSkillLevel(level: number, fieldName: string): void {
  if (!Number.isInteger(level) || level < 0 || level > MAX_SKILL_LEVEL) {
    throw new Error(`${fieldName} must be an integer between 0 and ${MAX_SKILL_LEVEL}.`);
  }
}

function assertAge(age: number, fieldName: string): void {
  if (!Number.isFinite(age) || age < BASE_TRAINING_AGE) {
    throw new Error(
      `${fieldName} must be a finite number greater than or equal to ${BASE_TRAINING_AGE}.`
    );
  }
}

function assertTrainingPosition(position: TrainingPosition | null): void {
  if (position !== null && ![0, 1, 2, 3].includes(position)) {
    throw new Error("assignedPosition must be null or one of: 0, 1, 2, 3.");
  }
}

function assertSnapshotId(snapshotId: string, fieldName: string): void {
  if (snapshotId.trim().length === 0) {
    throw new Error(`${fieldName} must not be empty.`);
  }
}

function assertCalendarCycles(calendarCycles: number): void {
  if (!Number.isInteger(calendarCycles) || calendarCycles <= 0) {
    throw new Error("calendarCycles must be a positive integer.");
  }
}

function assertTrainingEfficiencies(
  trainingEfficiencies: readonly number[],
  calendarCycles: number
): void {
  if (trainingEfficiencies.length !== calendarCycles) {
    throw new Error("trainingEfficiencies must contain one value per calendar cycle.");
  }

  for (const efficiency of trainingEfficiencies) {
    if (!Number.isFinite(efficiency) || efficiency < 0 || efficiency > MAX_TRAINING_EFFICIENCY) {
      throw new Error(
        `trainingEfficiencies values must be between 0 and ${MAX_TRAINING_EFFICIENCY}.`
      );
    }
  }
}

function assertValidTrainingAge(age: number): void {
  if (!Number.isFinite(age) || age < BASE_TRAINING_AGE) {
    throw new Error(`age must be a finite number greater than or equal to ${BASE_TRAINING_AGE}.`);
  }
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

function assertSupportedSkill(
  skill: string
): asserts skill is keyof typeof SKILL_TRAINING_BASE_LEVEL {
  if (!Object.hasOwn(SKILL_TRAINING_BASE_LEVEL, skill)) {
    throw new Error(`skill must be one of: ${Object.keys(SKILL_TRAINING_BASE_LEVEL).join(", ")}.`);
  }
}

function assertValidTargetSkillLevel(targetSkillLevel: number): void {
  if (
    !Number.isInteger(targetSkillLevel) ||
    targetSkillLevel < 0 ||
    targetSkillLevel > MAX_SKILL_LEVEL
  ) {
    throw new Error(`targetSkillLevel must be an integer between 0 and ${MAX_SKILL_LEVEL}.`);
  }
}
