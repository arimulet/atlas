import {
  ADVANCED_BASE_EFFICIENCY,
  AGE_TRAINING_FACTOR,
  BASE_TRAINING_AGE,
  BASE_TRAINING_POINTS,
  DEFAULT_TALENT_PROFILE_MINIMUM_OBSERVATIONS,
  FIRST_EFFICIENCY_THRESHOLD,
  FIRST_SEGMENT_EFFICIENCY,
  FRIENDLY_MATCH_WEIGHT,
  MAX_EFFICIENCY,
  MAX_EQUIVALENT_MINUTES,
  MAX_SKILL_LEVEL,
  MAX_TRAINING_EFFICIENCY,
  SKILL_LEVEL_TRAINING_FACTOR,
  SKILL_TRAINING_BASE_LEVEL,
  SUPPORTED_TRAINING_SKILLS
} from "./constants.js";
import type {
  EffectiveTrainingCyclesSource,
  SkillTrainingCostInput,
  SkillTrainingCostResult,
  SkillTrainingCostSkill,
  SkillProgressObservation,
  SkillProgressObservationConfidence,
  SkillProgressObservationInput,
  SkillProgressObservationStatus,
  TalentProfile,
  TalentProfileEffectiveTrainingCyclesSource,
  TalentProfileInput,
  TalentProfileSegment,
  TalentSkillProfile,
  TrainingEfficiencyInput,
  TrainingEfficiencyResult,
  TrainingPosition,
  TrainingType,
  TrainingSkillLevels,
  TrainingHistory,
  TrainingWeek,
  TrainingWeekInput,
  SkillUp,
  SkillUpObservation,
  SkillUpObservationCompleteness,
  TalentObservation,
  TalentObservationProfile,
  TalentObservationProfileInput,
  TalentObservationSkillProfile,
  ExpectedWeeksToSkillUpInput,
  ExpectedWeeksToSkillUpResult,
  ExpectedWeeksToSkillUpStatus,
  RequiredTrainingPointsInput,
  RequiredTrainingPointsResult,
  TalentEstimationInput,
  TalentEstimationResult
} from "./types.js";

export {
  AGE_TRAINING_FACTOR,
  BASE_TRAINING_AGE,
  BASE_TRAINING_POINTS,
  DEFAULT_TALENT_PROFILE_MINIMUM_OBSERVATIONS,
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
  TalentProfile,
  TalentProfileEffectiveTrainingCyclesSource,
  TalentProfileEvidenceReference,
  TalentProfileInput,
  TalentProfileSegment,
  TalentProfileStatus,
  TalentSkillProfile,
  TrainingEfficiencyInput,
  TrainingEfficiencyResult,
  TrainingPosition,
  TrainingType,
  TrainingSkillLevels,
  TrainingHistory,
  TrainingWeek,
  TrainingWeekInput,
  SkillUp,
  SkillUpObservation,
  SkillUpObservationCompleteness,
  TalentObservation,
  TalentObservationProfile,
  TalentObservationProfileInput,
  TalentObservationSkillProfile,
  ExpectedWeeksToSkillUpInput,
  ExpectedWeeksToSkillUpResult,
  ExpectedWeeksToSkillUpStatus,
  RequiredTrainingPointsInput,
  RequiredTrainingPointsResult,
  TalentEstimationInput,
  TalentEstimationResult
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

export function calculateWeeklyTrainingPoints(trainingEfficiency: number): number {
  assertEfficiency(trainingEfficiency, "trainingEfficiency");

  return trainingEfficiency;
}

export function createTrainingWeek(input: TrainingWeekInput): TrainingWeek {
  assertPlayerId(input.playerId);
  assertPositiveInteger(input.week, "week");
  assertSupportedSkill(input.skill);
  assertNonNegativeFinite(input.officialMinutes, "officialMinutes");
  assertNonNegativeFinite(input.friendlyMinutes, "friendlyMinutes");
  assertBoolean(input.advancedTraining, "advancedTraining");
  assertAge(input.playerAge, "playerAge");
  assertSkillLevel(input.skillLevelBefore, "skillLevelBefore");
  assertSkillLevel(input.skillLevelAfter, "skillLevelAfter");

  const efficiency = calculateTrainingEfficiency({
    officialMinutes: input.officialMinutes,
    friendlyMinutes: input.friendlyMinutes,
    advancedTraining: input.advancedTraining
  }).trainingEfficiency;

  const skillLevelsBefore = Object.freeze(
    normalizeSkillLevels(input.skillLevelsBefore, input.skill, input.skillLevelBefore)
  );
  const skillLevelsAfter = Object.freeze(
    normalizeSkillLevels(input.skillLevelsAfter, input.skill, input.skillLevelAfter)
  );

  return Object.freeze({
    playerId: input.playerId,
    week: input.week,
    skill: input.skill,
    officialMinutes: input.officialMinutes,
    friendlyMinutes: input.friendlyMinutes,
    advancedTraining: input.advancedTraining,
    playerAge: input.playerAge,
    skillLevelBefore: input.skillLevelBefore,
    skillLevelAfter: input.skillLevelAfter,
    skillLevelsBefore,
    skillLevelsAfter,
    trainingEfficiency: efficiency,
    trainingPoints: calculateWeeklyTrainingPoints(efficiency)
  });
}

export function createTrainingHistory(
  playerId: number,
  weeks: readonly TrainingWeek[] = []
): TrainingHistory {
  assertPlayerId(playerId);

  let history: TrainingHistory = { playerId, weeks: [] };
  for (const week of weeks) {
    history = addTrainingWeek(history, week);
  }

  return history;
}

export function addTrainingWeek(history: TrainingHistory, week: TrainingWeek): TrainingHistory {
  assertPlayerId(history.playerId);
  assertTrainingWeek(week);

  if (week.playerId !== history.playerId) {
    throw new Error("Training week playerId must match the history playerId.");
  }

  if (history.weeks.some((existingWeek) => existingWeek.week === week.week)) {
    throw new Error(`Training week ${week.week} already exists in the history.`);
  }

  return {
    playerId: history.playerId,
    weeks: [...history.weeks, week].sort(compareTrainingWeeks)
  };
}

export function getTrainingWeeks(history: TrainingHistory): TrainingWeek[] {
  return [...history.weeks].sort(compareTrainingWeeks);
}

export function getTrainingWeeksBetween(
  history: TrainingHistory,
  startWeek: number,
  endWeek: number
): TrainingWeek[] {
  assertPositiveInteger(startWeek, "startWeek");
  assertPositiveInteger(endWeek, "endWeek");

  if (endWeek < startWeek) {
    throw new Error("endWeek must be greater than or equal to startWeek.");
  }

  return getTrainingWeeks(history).filter((week) => week.week >= startWeek && week.week <= endWeek);
}

export function getTrainingWeeksForSkill(
  history: TrainingHistory,
  skill: SkillTrainingCostSkill
): TrainingWeek[] {
  assertSupportedSkill(skill);

  return getTrainingWeeks(history).filter((week) => week.skill === skill);
}

export function detectSkillUps(history: TrainingHistory): SkillUp[] {
  const weeks = getTrainingWeeks(history);
  const skillUps: SkillUp[] = [];

  for (let index = 1; index < weeks.length; index += 1) {
    const previousWeek = weeks[index - 1]!;
    const currentWeek = weeks[index]!;

    for (const skill of SUPPORTED_TRAINING_SKILLS) {
      const fromLevel = previousSkillLevel(previousWeek, skill);
      const toLevel = previousSkillLevel(currentWeek, skill);

      if (fromLevel !== null && toLevel !== null && toLevel > fromLevel) {
        skillUps.push({
          playerId: history.playerId,
          skill,
          fromLevel,
          toLevel,
          levelDelta: toLevel - fromLevel,
          week: currentWeek.week
        });
      }
    }
  }

  return skillUps;
}

export function buildSkillUpObservations(history: TrainingHistory): SkillUpObservation[] {
  const weeks = getTrainingWeeks(history);
  const skillUps = detectSkillUps(history);
  const previousPopBySkill = new Map<SkillTrainingCostSkill, SkillUp>();
  const observations: SkillUpObservation[] = [];

  for (const skillUp of skillUps) {
    const previousPop = previousPopBySkill.get(skillUp.skill);
    const accumulationStart = previousPop?.week ?? weeks[0]?.week;

    if (accumulationStart === undefined) {
      continue;
    }

    const firstAccumulationWeek = previousPop ? accumulationStart + 1 : accumulationStart;
    const trainingWeeks = weeks.filter(
      (week) => week.week >= firstAccumulationWeek && week.week <= skillUp.week
    );
    const hasMissingWeeks = hasMissingWeeksBetween(
      trainingWeeks,
      firstAccumulationWeek,
      skillUp.week
    );
    const completeness = determineCompleteness({
      previousPop,
      levelDelta: skillUp.levelDelta,
      hasMissingWeeks
    });
    const relevantWeeks = trainingWeeks.filter((week) => week.skill === skillUp.skill);

    observations.push({
      playerId: skillUp.playerId,
      skill: skillUp.skill,
      fromLevel: skillUp.fromLevel,
      toLevel: skillUp.toLevel,
      levelDelta: skillUp.levelDelta,
      startWeek: accumulationStart,
      popWeek: skillUp.week,
      accumulatedTrainingPoints: relevantWeeks.reduce(
        (total, week) => total + week.trainingPoints,
        0
      ),
      weeksObserved: trainingWeeks.length,
      weeksWithRelevantTraining: relevantWeeks.length,
      ageAtStart: trainingWeeks[0]?.playerAge ?? 0,
      ageAtPop: trainingWeeks[trainingWeeks.length - 1]?.playerAge ?? 0,
      completeness,
      eligibleForTalentEstimation: completeness === "complete",
      trainingWeeks
    });

    previousPopBySkill.set(skillUp.skill, skillUp);
  }

  return observations;
}

function previousSkillLevel(week: TrainingWeek, skill: SkillTrainingCostSkill): number | null {
  return week.skillLevelsAfter[skill] ?? week.skillLevelsBefore[skill] ?? null;
}

function determineCompleteness(input: {
  previousPop: SkillUp | undefined;
  levelDelta: number;
  hasMissingWeeks: boolean;
}): SkillUpObservationCompleteness {
  if (!input.previousPop) {
    return "left-censored";
  }

  if (input.levelDelta !== 1) {
    return "ambiguous";
  }

  return input.hasMissingWeeks ? "missing-weeks" : "complete";
}

function hasMissingWeeksBetween(
  weeks: readonly TrainingWeek[],
  startWeek: number,
  endWeek: number
): boolean {
  const expectedWeeks = endWeek - startWeek + 1;
  return (
    weeks.length !== expectedWeeks || weeks.some((week, index) => week.week !== startWeek + index)
  );
}

function normalizeSkillLevels(
  levels: TrainingSkillLevels | undefined,
  skill: SkillTrainingCostSkill,
  fallbackLevel: number
): TrainingSkillLevels {
  const normalized = { ...(levels ?? {}) };
  normalized[skill] ??= fallbackLevel;

  for (const [skillName, level] of Object.entries(normalized)) {
    assertSupportedSkill(skillName);
    if (typeof level !== "number") {
      throw new Error(`skillLevels.${skillName} must be a number.`);
    }
    assertSkillLevel(level, `skillLevels.${skillName}`);
  }

  return normalized;
}

function compareTrainingWeeks(left: TrainingWeek, right: TrainingWeek): number {
  return left.week - right.week;
}

function assertTrainingWeek(week: TrainingWeek): void {
  assertPlayerId(week.playerId);
  assertPositiveInteger(week.week, "week");
  assertSupportedSkill(week.skill);
  assertNonNegativeFinite(week.officialMinutes, "officialMinutes");
  assertNonNegativeFinite(week.friendlyMinutes, "friendlyMinutes");
  assertBoolean(week.advancedTraining, "advancedTraining");
  assertAge(week.playerAge, "playerAge");
  assertSkillLevel(week.skillLevelBefore, "skillLevelBefore");
  assertSkillLevel(week.skillLevelAfter, "skillLevelAfter");
  normalizeSkillLevels(week.skillLevelsBefore, week.skill, week.skillLevelBefore);
  normalizeSkillLevels(week.skillLevelsAfter, week.skill, week.skillLevelAfter);
  assertEfficiency(week.trainingEfficiency, "trainingEfficiency");
  assertNonNegativeFinite(week.trainingPoints, "trainingPoints");
}

function assertPositiveInteger(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }
}
export function estimateTalentFromSkillUpObservation(
  observation: SkillUpObservation
): TalentObservation {
  assertCompleteTalentObservation(observation);

  const relevantWeeks = observation.trainingWeeks.filter(
    (week) => week.skill === observation.skill && week.trainingPoints > 0
  );
  const observedTrainingPoints = relevantWeeks.reduce(
    (total, week) => total + week.trainingPoints,
    0
  );

  if (observedTrainingPoints <= 0) {
    throw new Error("SkillUpObservation must contain positive relevant training points.");
  }

  const effectiveAgeCostFactor =
    relevantWeeks.reduce(
      (total, week) => total + week.trainingPoints * calculateAgeTrainingCostFactor(week.playerAge),
      0
    ) / observedTrainingPoints;
  const effectiveAge = calculateEquivalentTrainingAge(effectiveAgeCostFactor);
  const skillCost = calculateSkillTrainingCostFactor({
    skill: observation.skill,
    targetSkillLevel: observation.toLevel
  });
  const estimatedTalent = calculateEstimatedTalent(
    observedTrainingPoints,
    effectiveAgeCostFactor,
    skillCost.costFactor
  );

  return {
    playerId: observation.playerId,
    skill: observation.skill,
    fromLevel: observation.fromLevel,
    toLevel: observation.toLevel,
    startWeek: observation.startWeek,
    popWeek: observation.popWeek,
    observedTrainingPoints,
    ageAtStart: observation.ageAtStart,
    ageAtPop: observation.ageAtPop,
    effectiveAge,
    effectiveAgeCostFactor,
    skillCostFactor: skillCost.costFactor,
    baseTrainingPoints: BASE_TRAINING_POINTS,
    estimatedTalent,
    sourceObservation: observation
  };
}

export function buildTalentObservationProfile(
  input: TalentObservationProfileInput
): TalentObservationProfile {
  assertPlayerId(input.playerId);

  const minimumObservations =
    input.minimumObservations ?? DEFAULT_TALENT_PROFILE_MINIMUM_OBSERVATIONS;
  assertMinimumComparableObservations(minimumObservations);

  const observations = [...input.observations];
  const eventKeys = new Set<string>();

  for (const observation of observations) {
    assertTalentObservationPlayer(observation, input.playerId);

    const eventKey = `${observation.skill}|${observation.popWeek}`;
    if (eventKeys.has(eventKey)) {
      throw new Error(`TalentObservation event ${eventKey} already exists in the profile.`);
    }
    eventKeys.add(eventKey);
  }

  const skills = createEmptyTalentObservationProfiles();
  for (const skill of SUPPORTED_TRAINING_SKILLS) {
    const skillObservations = observations.filter((observation) => observation.skill === skill);
    skills[skill] = buildTalentObservationSkillProfile(
      skill,
      skillObservations,
      minimumObservations
    );
  }

  return {
    playerId: input.playerId,
    minimumObservations,
    skills
  };
}

function buildTalentObservationSkillProfile(
  skill: SkillTrainingCostSkill,
  observations: TalentObservation[],
  minimumObservations: number
): TalentObservationSkillProfile {
  const estimatedTalents = observations.map((observation) => observation.estimatedTalent);
  const targetSkillLevels = [...new Set(observations.map((observation) => observation.toLevel))].sort(
    (left, right) => left - right
  );

  return {
    skill,
    observations,
    observationCount: observations.length,
    targetSkillLevels,
    medianEstimatedTalent: observations.length > 0 ? median(estimatedTalents) : null,
    minimumEstimatedTalent: observations.length > 0 ? Math.min(...estimatedTalents) : null,
    maximumEstimatedTalent: observations.length > 0 ? Math.max(...estimatedTalents) : null,
    status: observations.length >= minimumObservations ? "sufficient_data" : "insufficient_data"
  };
}

function createEmptyTalentObservationProfiles(): Record<
  SkillTrainingCostSkill,
  TalentObservationSkillProfile
> {
  const skills = {} as Record<SkillTrainingCostSkill, TalentObservationSkillProfile>;

  for (const skill of SUPPORTED_TRAINING_SKILLS) {
    skills[skill] = buildTalentObservationSkillProfile(skill, [], 1);
  }

  return skills;
}

function assertTalentObservationPlayer(
  observation: TalentObservation,
  playerId: number
): void {
  assertSupportedSkill(observation.skill);
  assertPositiveInteger(observation.popWeek, "popWeek");
  assertPositiveFinite(observation.estimatedTalent, "estimatedTalent");

  if (
    observation.playerId !== playerId ||
    observation.sourceObservation.playerId !== playerId
  ) {
    throw new Error("All TalentObservations must belong to the profile playerId.");
  }

  if (observation.skill !== observation.sourceObservation.skill) {
    throw new Error("TalentObservation skill must match its source SkillUpObservation.");
  }
}

export function calculateExpectedWeeksToSkillUp(
  input: ExpectedWeeksToSkillUpInput
): ExpectedWeeksToSkillUpResult {
  assertPlayerId(input.profile.playerId);
  assertSupportedSkill(input.skill);
  assertValidTrainingAge(input.age);
  assertSkillLevel(input.currentSkillLevel, "currentSkillLevel");

  if (input.currentSkillLevel >= MAX_SKILL_LEVEL) {
    throw new Error("currentSkillLevel must be less than the maximum skill level.");
  }

  const targetSkillLevel = input.currentSkillLevel + 1;
  const weeklyTrainingPoints = calculateWeeklyTrainingPoints(MAX_TRAINING_EFFICIENCY);
  const skillProfile = input.profile.skills[input.skill];
  const baseResult = {
    playerId: input.profile.playerId,
    skill: input.skill,
    fromLevel: input.currentSkillLevel,
    targetSkillLevel,
    age: input.age,
    baseTrainingPoints: BASE_TRAINING_POINTS,
    weeklyTrainingPoints,
    sourceObservationCount: skillProfile.observationCount
  };

  if (skillProfile.status !== "sufficient_data" || skillProfile.medianEstimatedTalent === null) {
    return {
      ...baseResult,
      talent: null,
      ageCostFactor: null,
      skillCostFactor: null,
      requiredTrainingPoints: null,
      expectedWeeks: null,
      status: "insufficient_data"
    };
  }

  const requiredTraining = calculateRequiredTrainingPoints({
    talent: skillProfile.medianEstimatedTalent,
    age: input.age,
    skill: input.skill,
    targetSkillLevel
  });

  return {
    ...baseResult,
    talent: requiredTraining.talent,
    ageCostFactor: requiredTraining.ageCostFactor,
    skillCostFactor: requiredTraining.skillCostFactor,
    requiredTrainingPoints: requiredTraining.requiredTrainingPoints,
    expectedWeeks: requiredTraining.requiredTrainingPoints / weeklyTrainingPoints,
    status: "calculable"
  };
}
function assertCompleteTalentObservation(observation: SkillUpObservation): void {
  if (observation.completeness !== "complete" || !observation.eligibleForTalentEstimation) {
    throw new Error("Only complete SkillUpObservations can estimate talent.");
  }

  if (observation.levelDelta !== 1) {
    throw new Error("Talent estimation requires a one-level SkillUpObservation.");
  }
}

function calculateEstimatedTalent(
  observedTrainingPoints: number,
  ageCostFactor: number,
  skillCostFactor: number
): number {
  return observedTrainingPoints / (ageCostFactor * skillCostFactor * BASE_TRAINING_POINTS);
}

function calculateEquivalentTrainingAge(ageCostFactor: number): number {
  return BASE_TRAINING_AGE + Math.log(ageCostFactor) / Math.log(AGE_TRAINING_FACTOR);
}
export function calculateRequiredTrainingPoints(
  input: RequiredTrainingPointsInput
): RequiredTrainingPointsResult {
  assertPositiveFinite(input.talent, "talent");
  assertPositiveFinite(BASE_TRAINING_POINTS, "BASE_TRAINING_POINTS");

  const ageCostFactor = calculateAgeTrainingCostFactor(input.age);
  const skillCost = calculateSkillTrainingCostFactor({
    skill: input.skill,
    targetSkillLevel: input.targetSkillLevel
  });
  const requiredTrainingPoints =
    input.talent * ageCostFactor * skillCost.costFactor * BASE_TRAINING_POINTS;

  return {
    talent: input.talent,
    age: input.age,
    skill: input.skill,
    targetSkillLevel: input.targetSkillLevel,
    ageCostFactor,
    skillCostFactor: skillCost.costFactor,
    baseTrainingPoints: BASE_TRAINING_POINTS,
    requiredTrainingPoints
  };
}

export function estimateTalent(input: TalentEstimationInput): TalentEstimationResult {
  assertPositiveFinite(input.observedTrainingPoints, "observedTrainingPoints");
  assertPositiveFinite(BASE_TRAINING_POINTS, "BASE_TRAINING_POINTS");

  const ageCostFactor = calculateAgeTrainingCostFactor(input.age);
  const skillCost = calculateSkillTrainingCostFactor({
    skill: input.skill,
    targetSkillLevel: input.targetSkillLevel
  });
  const estimatedTalent = calculateEstimatedTalent(
    input.observedTrainingPoints,
    ageCostFactor,
    skillCost.costFactor
  );

  return {
    observedTrainingPoints: input.observedTrainingPoints,
    age: input.age,
    skill: input.skill,
    targetSkillLevel: input.targetSkillLevel,
    ageCostFactor,
    skillCostFactor: skillCost.costFactor,
    baseTrainingPoints: BASE_TRAINING_POINTS,
    estimatedTalent
  };
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

export function buildTalentProfile(input: TalentProfileInput): TalentProfile {
  assertPlayerId(input.playerId);

  const minimumComparableObservations =
    input.minimumComparableObservations ?? DEFAULT_TALENT_PROFILE_MINIMUM_OBSERVATIONS;
  assertMinimumComparableObservations(minimumComparableObservations);

  const observations = [...input.observations];
  for (const observation of observations) {
    assertObservationPlayer(observation, input.playerId);
  }

  const skills = createEmptySkillProfiles();
  for (const skill of SUPPORTED_TRAINING_SKILLS) {
    const skillObservations = observations.filter((observation) => observation.skill === skill);
    skills[skill] = buildSkillProfile(skill, skillObservations, minimumComparableObservations);
  }

  return {
    playerId: input.playerId,
    minimumComparableObservations,
    skills
  };
}

function buildSkillProfile(
  skill: SkillTrainingCostSkill,
  observations: SkillProgressObservation[],
  minimumComparableObservations: number
): TalentSkillProfile {
  const progressionObservations = observations.filter(isProgressionObservation);
  const censoredCount = observations.filter(
    (observation) => observation.status === "censored"
  ).length;
  const segments = buildSegments(progressionObservations, minimumComparableObservations);

  return {
    skill,
    observations,
    progressionCount: progressionObservations.length,
    censoredCount,
    segments
  };
}

function buildSegments(
  observations: SkillProgressObservation[],
  minimumComparableObservations: number
): TalentProfileSegment[] {
  const grouped = new Map<string, SkillProgressObservation[]>();

  for (const observation of observations) {
    const key = segmentKey(observation);
    grouped.set(key, [...(grouped.get(key) ?? []), observation]);
  }

  return [...grouped.values()]
    .map((segmentObservations) => buildSegment(segmentObservations, minimumComparableObservations))
    .sort(compareSegments);
}

function buildSegment(
  observations: SkillProgressObservation[],
  minimumComparableObservations: number
): TalentProfileSegment {
  const first = observations[0]!;
  const calendarWeeks = observations.map((observation) => observation.calendarWeeksPerLevel!);
  const effectiveWeeks = observations.map((observation) => observation.effectiveWeeksPerLevel!);
  const confidence = calculateSegmentConfidence(observations, minimumComparableObservations);
  const comparableObservationCount = observations.length;

  return {
    targetSkillLevel: first.toLevel,
    ageAtStart: first.ageAtStart,
    trainingType: first.trainingType,
    assignedPosition: first.assignedPosition,
    comparableObservationCount,
    evidence: observations.map((observation) => ({
      startSnapshotId: observation.startSnapshotId,
      endSnapshotId: observation.endSnapshotId
    })),
    calendarWeeksPerLevel: median(calendarWeeks),
    effectiveWeeksPerLevel: median(effectiveWeeks),
    effectiveTrainingCyclesSource: effectiveTrainingCyclesSource(observations),
    status:
      comparableObservationCount >= minimumComparableObservations
        ? "sufficient_data"
        : "insufficient_data",
    confidence
  };
}

function isProgressionObservation(observation: SkillProgressObservation): boolean {
  return (
    observation.status === "progressed" &&
    observation.levelDelta > 0 &&
    observation.calendarWeeksPerLevel !== null &&
    observation.effectiveWeeksPerLevel !== null
  );
}

function segmentKey(observation: SkillProgressObservation): string {
  return [
    observation.toLevel,
    observation.ageAtStart,
    observation.trainingType ?? "unknown-training-type",
    observation.assignedPosition ?? "unknown-position"
  ].join("|");
}

function compareSegments(left: TalentProfileSegment, right: TalentProfileSegment): number {
  return (
    left.targetSkillLevel - right.targetSkillLevel ||
    left.ageAtStart - right.ageAtStart ||
    String(left.trainingType).localeCompare(String(right.trainingType)) ||
    positionSortValue(left.assignedPosition) - positionSortValue(right.assignedPosition)
  );
}

function positionSortValue(position: TrainingPosition | null): number {
  return position ?? -1;
}

function calculateSegmentConfidence(
  observations: SkillProgressObservation[],
  minimumComparableObservations: number
): SkillProgressObservationConfidence {
  if (observations.length < minimumComparableObservations) {
    return "low";
  }

  if (
    observations.length >= 3 &&
    observations.every((observation) => observation.confidence === "high")
  ) {
    return "high";
  }

  if (observations.every((observation) => observation.confidence !== "low")) {
    return "medium";
  }

  return "low";
}

function effectiveTrainingCyclesSource(
  observations: SkillProgressObservation[]
): TalentProfileEffectiveTrainingCyclesSource {
  const sources = new Set<EffectiveTrainingCyclesSource>(
    observations.map((observation) => observation.effectiveTrainingCyclesSource)
  );

  return sources.size === 1 ? [...sources][0]! : "mixed";
}

function median(values: number[]): number {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);

  return ordered.length % 2 === 0
    ? (ordered[middle - 1]! + ordered[middle]!) / 2
    : ordered[middle]!;
}

function createEmptySkillProfiles(): Record<SkillTrainingCostSkill, TalentSkillProfile> {
  const skills = {} as Record<SkillTrainingCostSkill, TalentSkillProfile>;

  for (const skill of SUPPORTED_TRAINING_SKILLS) {
    skills[skill] = {
      skill,
      observations: [],
      progressionCount: 0,
      censoredCount: 0,
      segments: []
    };
  }

  return skills;
}

function assertPositiveFinite(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${fieldName} must be a finite positive number.`);
  }
}
function assertMinimumComparableObservations(value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("minimumComparableObservations must be a positive integer.");
  }
}

function assertObservationPlayer(observation: SkillProgressObservation, playerId: number): void {
  if (observation.playerId !== playerId) {
    throw new Error("All observations must belong to the profile playerId.");
  }
}
