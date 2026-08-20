import {
  AGE_TRAINING_FACTOR,
  BASE_TRAINING_AGE,
  BASE_TRAINING_POINTS,
  DEFAULT_TALENT_FOR_RELATIVE_COMPARISON,
  DEFAULT_TALENT_PROFILE_MINIMUM_OBSERVATIONS,
  MAX_EFFICIENCY,
  MAX_SKILL_LEVEL,
  MAX_TRAINING_EFFICIENCY,
  SKILL_LEVEL_TRAINING_FACTOR,
  SKILL_TRAINING_BASE_LEVEL,
  TRAINING_KIND_EFFECTIVENESS,
  TRAINING_RECOMMENDATION_SCORE_NORMALIZATION_BASE,
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
  Skill,
  SkillChange,
  TalentProfile,
  TalentProfileEffectiveTrainingCyclesSource,
  TalentProfileInput,
  TalentProfileSegment,
  TalentSkillProfile,
  PlayerSkill,
  PlayerSkills,
  PlayerSkillsChange,
  PlayerTrainingWeek,
  TrainingKind,
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
  TalentConfidence,
  TalentEstimate,
  TalentEvidence,
  TalentObservationProfile,
  TalentObservationProfileInput,
  TalentObservationSkillProfile,
  ExpectedWeeksToSkillUpInput,
  ExpectedWeeksToSkillUpResult,
  RequiredTrainingPointsInput,
  RequiredTrainingPointsResult,
  TalentEstimationInput,
  TalentEstimationResult,
  DevelopmentReturnScoreInput,
  TrainingOptionScoreBreakdown,
  TrainingPointsByKindInput,
  WeeklyTrainingPlayerInput,
  WeeklyTrainingPlayerReport,
  WeeklyTrainingReport,
  WeeklyTrainingReportInput
} from "./types.js";

const PLAYER_SKILLS: readonly PlayerSkill[] = [
  "pace",
  "stamina",
  "keeper",
  "playmaking",
  "passing",
  "technique",
  "defending",
  "striker"
];

export {
  AGE_TRAINING_FACTOR,
  BASE_TRAINING_AGE,
  BASE_TRAINING_POINTS,
  DEFAULT_TALENT_FOR_RELATIVE_COMPARISON,
  DEFAULT_TALENT_PROFILE_MINIMUM_OBSERVATIONS,
  MAX_SKILL_LEVEL,
  MAX_TRAINING_EFFICIENCY,
  SKILL_LEVEL_TRAINING_FACTOR,
  SKILL_TRAINING_BASE_LEVEL,
  TRAINING_KIND_EFFECTIVENESS,
  ADVANCED_TRAINING_SLOT_COUNT,
  ADVANCED_SLOT_HIGH_DEVELOPMENT_POTENTIAL_THRESHOLD,
  ADVANCED_SLOT_REPLACEMENT_THRESHOLD,
  TRAINING_RECOMMENDATION_HIGH_NEXT_LEVEL_WEEKS,
  TRAINING_RECOMMENDATION_MIN_HISTORY_WEEKS,
  TRAINING_RECOMMENDATION_RECENT_SWITCH_THRESHOLD,
  TRAINING_RECOMMENDATION_SCORE_NORMALIZATION_BASE,
  TRAINING_RECOMMENDATION_SKILL_UP_SOON_WEEKS,
  TRAINING_RECOMMENDATION_SWITCH_THRESHOLD,
  TRAINING_CALIBRATION_HIGH_PREDICTION_ERROR_WEEKS,
  TRAINING_CALIBRATION_MIN_FLAPPING_OBSERVATIONS,
  TRAINING_CALIBRATION_BORDERLINE_RANK_START,
  TRAINING_CALIBRATION_BORDERLINE_RANK_END,
  TRAINING_CALIBRATION_RANK_INSTABILITY_DELTA
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
  Skill,
  SkillChange,
  SkillChangeDirection,
  TalentProfile,
  TalentProfileEffectiveTrainingCyclesSource,
  TalentProfileEvidenceReference,
  TalentProfileInput,
  TalentProfileSegment,
  TalentProfileStatus,
  TalentSkillProfile,
  PlayerSkill,
  PlayerSkills,
  PlayerSkillsChange,
  PlayerTrainingWeek,
  TrainingKind,
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
  TalentConfidence,
  TalentEstimate,
  TalentEvidence,
  TalentObservationProfile,
  TalentObservationProfileInput,
  TalentObservationSkillProfile,
  ExpectedWeeksToSkillUpInput,
  ExpectedWeeksToSkillUpResult,
  ExpectedWeeksToSkillUpStatus,
  RequiredTrainingPointsInput,
  RequiredTrainingPointsResult,
  TalentEstimationInput,
  TalentEstimationResult,
  TrainingRecommendationStatus,
  TrainingRecommendationConfidence,
  TrainingRecommendationPlayer,
  PlayerTrainingRecommendationContext,
  TrainingOptionEvaluation,
  TrainingRecommendationReason,
  PlayerTrainingRecommendation,
  DevelopmentReturnScoreInput,
  TrainingOptionScoreBreakdown,
  TrainingPointsByKindInput,
  AdvancedTrainingCandidateContext,
  AdvancedSlotEvaluation,
  AdvancedTrainingRankingEntry,
  AdvancedTrainingRecommendation,
  AdvancedSlotReason,
  AdvancedTrainingPlayerRecommendation,
  AdvancedSlotReplacement,
  AdvancedSlotScoreInput,
  AdvancedTrainingOptimization,
  AdvancedScoreBreakdown,
  CalibrationWarning,
  CalibrationConfidence,
  TrainingCalibrationEntry,
  SkillUpBacktestPrediction,
  SkillUpBacktestSummary,
  RecommendationCalibrationObservation,
  RankingStability,
  AdvancedTrainingCalibrationSummary,
  CalibrationWarningSummary,
  TrainingCalibrationScenario,
  TrainingCalibrationDatasetSelection,
  TrainingCalibrationPlayerContext,
  WeeklyTrainingCalibrationInput,
  WeeklyTrainingCalibrationReport,
  WeeklyTrainingPlayerInput,
  WeeklyTrainingPlayerReport,
  WeeklyTrainingReport,
  WeeklyTrainingReportInput
} from "./types.js";

export function calculateAgeTrainingCostFactor(age: number): number {
  assertValidTrainingAge(age);

  return Math.pow(AGE_TRAINING_FACTOR, age - BASE_TRAINING_AGE);
}

export function calculateRelativeTrainingSpeed(age: number): number {
  return 1 / calculateAgeTrainingCostFactor(age);
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

export function calculateWeeklyTrainingPoints(intensity: number): number {
  assertEfficiency(intensity, "intensity");

  return intensity;
}

export function calculateWeeklyTrainingPointsByKind(input: TrainingPointsByKindInput): number {
  const baseTrainingPoints = calculateWeeklyTrainingPoints(input.intensity);
  return baseTrainingPoints * TRAINING_KIND_EFFECTIVENESS[input.kind];
}

export function createTrainingWeek(input: TrainingWeekInput): TrainingWeek {
  assertPlayerId(input.playerId);
  assertPositiveInteger(input.gameWeek, "gameWeek");
  assertPositiveInteger(input.seasonWeek, "seasonWeek");
  assertDate(input.date);
  assertTrainingType(input.type);
  assertTrainingKind(input.kind);
  assertEfficiency(input.intensity, "intensity");
  assertAge(input.age, "age");
  assertSkills(input.skills, "skills");
  assertSkillChanges(input.skillsChange);

  const skill = input.skill ?? trainingSkillForType(input.type);
  assertSupportedSkill(skill);
  const skillLevelAfter = skillValue(input.skills, skill) ?? input.skillLevelAfter ?? 0;
  const skillLevelBefore =
    skillChangeValue(input.skillsChange, skill) === undefined
      ? (input.skillLevelBefore ?? skillLevelAfter)
      : skillLevelAfter - skillChangeValue(input.skillsChange, skill)!;
  assertSkillLevel(skillLevelBefore, "skillLevelBefore");
  assertSkillLevel(skillLevelAfter, "skillLevelAfter");

  const skillLevelsBefore = Object.freeze(
    normalizeSkillLevels(input.skillLevelsBefore, skill, skillLevelBefore)
  );
  const skillLevelsAfter = Object.freeze(
    normalizeSkillLevels(input.skillLevelsAfter, skill, skillLevelAfter)
  );
  const skillChanges = Object.freeze(deriveSkillChanges(input.skills, input.skillsChange));

  return Object.freeze({
    ...input,
    playerId: input.playerId,
    week: input.gameWeek,
    skill,
    playerAge: input.age,
    skillLevelBefore,
    skillLevelAfter,
    skillLevelsBefore,
    skillLevelsAfter,
    trainingPoints: calculateWeeklyTrainingPoints(input.intensity),
    skillChanges,
    date: new Date(input.date),
    skills: Object.freeze({ ...input.skills }),
    skillsChange: Object.freeze({ ...input.skillsChange })
  });
}

/**
 * Derives visible skill events from Sokker's factual skill levels and deltas.
 * The individual deltas are authoritative; `up` and `down` are consistency
 * counters only.
 */
export function deriveSkillChanges(
  skills: PlayerSkills,
  changes: PlayerSkillsChange
): SkillChange[] {
  const skillChanges: SkillChange[] = [];

  for (const skill of PLAYER_SKILLS) {
    const delta = changes[skill];
    const after = skills[skill];

    if (delta === undefined || delta === 0 || after === undefined) {
      continue;
    }

    skillChanges.push({
      skill,
      before: after - delta,
      after,
      delta,
      direction: delta > 0 ? "up" : "down"
    });
  }

  const positiveChanges = skillChanges.filter((change) => change.delta > 0).length;
  const negativeChanges = skillChanges.filter((change) => change.delta < 0).length;

  if (positiveChanges !== changes.up || negativeChanges !== changes.down) {
    console.warn(
      `Sokker skillsChange counters are inconsistent: expected ${changes.up}/${changes.down}, ` +
        `derived ${positiveChanges}/${negativeChanges}.`
    );
  }

  return skillChanges;
}

export function createPlayerTrainingWeek(input: TrainingWeekInput): PlayerTrainingWeek {
  return createTrainingWeek(input);
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

export function buildWeeklyTrainingReport(input: WeeklyTrainingReportInput): WeeklyTrainingReport {
  const allWeeks = input.players.flatMap((player) => getTrainingWeeks(player.history));
  const gameWeek = input.gameWeek ?? latestGameWeek(allWeeks);
  assertPositiveInteger(gameWeek, "gameWeek");

  const weeklyPlayers = input.players
    .map((player) => buildWeeklyTrainingPlayerReport(player, gameWeek, input.talents))
    .filter((player): player is WeeklyTrainingPlayerReport => player !== null);

  const selectedWeek = allWeeks.find((week) => week.week === gameWeek);
  const date = input.date ?? selectedWeek?.date;
  if (!date) {
    throw new Error(`No training report date is available for gameWeek ${gameWeek}.`);
  }
  assertDate(date);

  const advancedPlayers = weeklyPlayers.filter(
    (player) => player.training.kind === "advanced"
  ).length;
  const formationPlayers = weeklyPlayers.filter(
    (player) => player.training.kind === "formation"
  ).length;
  const totalIntensity = weeklyPlayers.reduce(
    (total, player) => total + player.training.intensity,
    0
  );

  return {
    gameWeek,
    date: new Date(date),
    players: weeklyPlayers,
    summary: {
      trainedPlayers: weeklyPlayers.length,
      advancedPlayers,
      formationPlayers,
      skillUps: weeklyPlayers.filter((player) => player.skill.skillUp).length,
      averageIntensity: weeklyPlayers.length === 0 ? 0 : totalIntensity / weeklyPlayers.length
    }
  };
}

export function calculateDevelopmentReturnScore(input: DevelopmentReturnScoreInput): number | null {
  return calculateDevelopmentReturnScoreBreakdown(input)?.developmentReturnScore ?? null;
}

export function calculateDevelopmentReturnScoreBreakdown(
  input: DevelopmentReturnScoreInput
): TrainingOptionScoreBreakdown | null {
  if (
    input.currentSkillLevel >= MAX_SKILL_LEVEL ||
    input.expectedWeeklyTrainingPoints <= 0 ||
    !Number.isFinite(input.expectedWeeklyTrainingPoints)
  ) {
    return null;
  }

  const talent = input.talent ?? DEFAULT_TALENT_FOR_RELATIVE_COMPARISON;
  const requiredTraining = calculateRequiredTrainingPoints({
    talent,
    age: input.age,
    skill: input.skill,
    targetSkillLevel: input.currentSkillLevel + 1
  });
  const expectedTrainingCost =
    requiredTraining.requiredTrainingPoints / input.expectedWeeklyTrainingPoints;
  const expectedDevelopmentValue = (MAX_SKILL_LEVEL - input.currentSkillLevel) / MAX_SKILL_LEVEL;
  const rawScore = expectedDevelopmentValue / expectedTrainingCost;
  const developmentReturnScore =
    rawScore / (TRAINING_RECOMMENDATION_SCORE_NORMALIZATION_BASE + rawScore);

  return {
    skill: input.skill,
    level: input.currentSkillLevel,
    requiredPoints: requiredTraining.requiredTrainingPoints,
    weeklyPoints: input.expectedWeeklyTrainingPoints,
    estimatedWeeks: expectedTrainingCost,
    developmentValue: expectedDevelopmentValue,
    ageCostFactor: requiredTraining.ageCostFactor,
    skillCostFactor: requiredTraining.skillCostFactor,
    talent,
    developmentReturnScore
  };
}

function buildWeeklyTrainingPlayerReport(
  input: WeeklyTrainingPlayerInput,
  gameWeek: number,
  talents: WeeklyTrainingReportInput["talents"]
): WeeklyTrainingPlayerReport | null {
  const weeks = getTrainingWeeks(input.history);
  const currentWeek = weeks.find((week) => week.week === gameWeek);

  if (!currentWeek || currentWeek.kind === "missing") {
    return null;
  }

  const skillChange = currentWeek.skillChanges.find(
    (change) => toTrainingCostSkill(change.skill) === currentWeek.skill
  );
  const skillUp = skillChange?.direction === "up";
  const previousLevel = skillChange
    ? currentWeek.skillLevelBefore
    : previousObservedSkillLevel(weeks, currentWeek);
  const talent = input.talent !== undefined ? input.talent : talentForPlayer(input, talents);
  const progress = buildWeeklyProgress(weeks, currentWeek, talent);

  return {
    playerId: currentWeek.playerId,
    gameWeek,
    training: {
      skill: currentWeek.skill,
      kind: currentWeek.kind,
      intensity: currentWeek.intensity
    },
    skill: {
      previousLevel,
      currentLevel: currentWeek.skillLevelAfter,
      skillUp
    },
    trainingPoints: {
      earned: calculateWeeklyTrainingPoints(currentWeek.intensity),
      estimatedProgress: progress?.estimatedProgress ?? null,
      remainingToNextLevel: progress?.remainingToNextLevel ?? null,
      estimatedWeeksToNextLevel: progress?.estimatedWeeksToNextLevel ?? null
    }
  };
}

function previousObservedSkillLevel(
  weeks: readonly TrainingWeek[],
  currentWeek: TrainingWeek
): number {
  const previousWeek = [...weeks]
    .reverse()
    .find((week) => week.week < currentWeek.week && week.skill === currentWeek.skill);

  return previousWeek?.skillLevelAfter ?? currentWeek.skillLevelBefore;
}

interface WeeklyProgress {
  estimatedProgress: number;
  remainingToNextLevel: number;
  estimatedWeeksToNextLevel: number | null;
}

function buildWeeklyProgress(
  weeks: readonly TrainingWeek[],
  currentWeek: TrainingWeek,
  talent: number | null | undefined
): WeeklyProgress | null {
  if (talent === null || talent === undefined || currentWeek.skillLevelAfter >= MAX_SKILL_LEVEL) {
    return null;
  }

  const relevantWeeks = weeks.filter((week) => week.week <= currentWeek.week);
  const skillUps = detectSkillUps({ playerId: currentWeek.playerId, weeks: relevantWeeks }).filter(
    (skillUp) => skillUp.skill === currentWeek.skill
  );
  const lastSkillUp = skillUps.at(-1);
  if (!lastSkillUp) {
    return null;
  }

  const accumulationWeeks = relevantWeeks.filter(
    (week) => week.week > lastSkillUp.week && week.week <= currentWeek.week
  );
  if (!hasCompleteTrainingHistory(accumulationWeeks, lastSkillUp.week + 1, currentWeek.week)) {
    return null;
  }

  const accumulatedTrainingPoints = accumulationWeeks
    .filter((week) => week.skill === currentWeek.skill)
    .reduce((total, week) => total + calculateWeeklyTrainingPoints(week.intensity), 0);
  const requiredTraining = calculateRequiredTrainingPoints({
    talent,
    age: currentWeek.playerAge,
    skill: currentWeek.skill,
    targetSkillLevel: currentWeek.skillLevelAfter + 1
  });
  const remainingToNextLevel = Math.max(
    0,
    requiredTraining.requiredTrainingPoints - accumulatedTrainingPoints
  );
  const estimatedProgress = Math.min(
    1,
    Math.max(0, accumulatedTrainingPoints / requiredTraining.requiredTrainingPoints)
  );
  const expectedWeeklyTrainingPoints = calculateWeeklyTrainingPoints(currentWeek.intensity);

  return {
    estimatedProgress,
    remainingToNextLevel,
    estimatedWeeksToNextLevel:
      remainingToNextLevel === 0
        ? 0
        : expectedWeeklyTrainingPoints > 0
          ? remainingToNextLevel / expectedWeeklyTrainingPoints
          : null
  };
}

function hasCompleteTrainingHistory(
  weeks: readonly TrainingWeek[],
  startWeek: number,
  endWeek: number
): boolean {
  if (endWeek < startWeek) {
    return true;
  }

  return (
    weeks.length === endWeek - startWeek + 1 &&
    weeks.every((week, index) => week.week === startWeek + index)
  );
}

function talentForPlayer(
  input: WeeklyTrainingPlayerInput,
  talents: WeeklyTrainingReportInput["talents"]
): number | null {
  const explicitTalent = readTalent(talents, input.history.playerId);
  if (explicitTalent !== undefined) {
    return explicitTalent;
  }

  return estimateTalentFromTrainingHistory(input.history).value;
}

function readTalent(
  talents: WeeklyTrainingReportInput["talents"],
  playerId: number
): number | null | undefined {
  if (!talents) {
    return undefined;
  }

  return "get" in talents ? talents.get(playerId) : talents[playerId];
}

function latestGameWeek(weeks: readonly TrainingWeek[]): number {
  const latestWeek = weeks.reduce((latest, week) => Math.max(latest, week.week), 0);
  if (latestWeek === 0) {
    throw new Error("At least one training week is required to build a report.");
  }
  return latestWeek;
}

export function detectSkillUps(history: TrainingHistory): SkillUp[] {
  const skillUps: SkillUp[] = [];

  for (const currentWeek of getTrainingWeeks(history)) {
    for (const change of currentWeek.skillChanges) {
      if (change.direction === "up") {
        skillUps.push({
          playerId: history.playerId,
          skill: toTrainingCostSkill(change.skill),
          fromLevel: change.before,
          toLevel: change.after,
          levelDelta: change.delta,
          week: currentWeek.week
        });
      }
    }
  }

  return skillUps;
}

export function detectTalentEvidence(history: TrainingHistory): TalentEvidence[] {
  const weeks = getTrainingWeeks(history);
  const popsBySkill = new Map<Skill, SkillChangeEvent>();
  const evidences: TalentEvidence[] = [];

  for (const week of weeks) {
    for (const change of week.skillChanges) {
      if (change.direction !== "up") {
        continue;
      }

      const currentPop: SkillChangeEvent = { week, change };
      const previousPop = popsBySkill.get(change.skill);

      if (previousPop) {
        const evidence = buildTalentEvidence(previousPop, currentPop, weeks, history.playerId);
        if (evidence) {
          evidences.push(evidence);
        }
      }

      popsBySkill.set(change.skill, currentPop);
    }
  }

  return evidences;
}

export function estimateTalentFromEvidence(evidences: readonly TalentEvidence[]): TalentEstimate {
  if (evidences.length === 0) {
    return { value: null, confidence: "unknown", evidenceCount: 0, evidences: [] };
  }

  const ordered = [...evidences].sort((left, right) => left.toWeek - right.toWeek);
  const values = ordered.map((evidence) => evidence.estimatedTalent);
  const robustValues = robustTalentValues(values);
  const representative =
    robustValues.reduce((total, value) => total + value, 0) / robustValues.length;
  const dispersion = relativeDispersion(robustValues, representative);
  const confidence = talentConfidenceFor(ordered.length, dispersion);

  return {
    value: Number.isFinite(representative) ? representative : null,
    confidence,
    evidenceCount: ordered.length,
    evidences: ordered
  };
}

export function estimateTalentFromTrainingHistory(history: TrainingHistory): TalentEstimate {
  return estimateTalentFromEvidence(detectTalentEvidence(history));
}

interface SkillChangeEvent {
  week: TrainingWeek;
  change: SkillChange;
}

function buildTalentEvidence(
  initialPop: SkillChangeEvent,
  finalPop: SkillChangeEvent,
  weeks: readonly TrainingWeek[],
  playerId: number
): TalentEvidence | null {
  if (
    initialPop.change.delta !== 1 ||
    finalPop.change.delta !== 1 ||
    initialPop.change.after !== finalPop.change.before ||
    finalPop.week.week <= initialPop.week.week
  ) {
    return null;
  }

  const firstTrainingWeek = initialPop.week.week + 1;
  const trainingWeeks = weeks.filter(
    (week) => week.week >= firstTrainingWeek && week.week <= finalPop.week.week
  );

  if (hasMissingWeeksBetween(trainingWeeks, firstTrainingWeek, finalPop.week.week)) {
    return null;
  }

  if (
    trainingWeeks.some(
      (week) =>
        week.kind === "formation" ||
        (week.kind === "missing" && week.intensity !== 0) ||
        (week.kind !== "missing" &&
          (week.kind !== "advanced" || !isTrainingTypeForSkill(week.type, finalPop.change.skill)))
    )
  ) {
    return null;
  }

  const skill = toTrainingCostSkill(finalPop.change.skill);
  const accumulatedTrainingPoints = trainingWeeks.reduce(
    (total, week) => total + week.trainingPoints,
    0
  );
  const ageWeightedTrainingPoints = trainingWeeks.reduce(
    (total, week) => total + week.trainingPoints * calculateAgeTrainingCostFactor(week.playerAge),
    0
  );
  const skillCost = calculateSkillTrainingCostFactor({
    skill,
    targetSkillLevel: finalPop.change.after
  });
  const estimatedTalent = ageWeightedTrainingPoints / (skillCost.costFactor * BASE_TRAINING_POINTS);

  return {
    playerId,
    skill: finalPop.change.skill,
    fromLevel: finalPop.change.before,
    toLevel: finalPop.change.after,
    fromWeek: initialPop.week.week,
    toWeek: finalPop.week.week,
    trainingWeeks: trainingWeeks.length,
    accumulatedTrainingPoints,
    estimatedTalent,
    confidence: 1
  };
}

function isTrainingTypeForSkill(type: TrainingType, skill: Skill): boolean {
  return type === skill || (skill === "striker" && type === "striker");
}

function toTrainingCostSkill(skill: Skill): SkillTrainingCostSkill {
  return skill === "striker" ? "scoring" : skill;
}

function robustTalentValues(values: readonly number[]): number[] {
  const medianValue = median([...values]);
  return values.length >= 3
    ? values.filter((value) => Math.abs(value - medianValue) <= Math.max(1, medianValue * 0.5))
    : [...values];
}

function relativeDispersion(values: readonly number[], center: number): number {
  if (values.length < 2 || center === 0) {
    return 0;
  }

  const variance =
    values.reduce((total, value) => total + Math.pow(value - center, 2), 0) / values.length;
  return Math.sqrt(variance) / Math.abs(center);
}

function talentConfidenceFor(count: number, dispersion: number): TalentConfidence {
  let confidence: TalentConfidence = count >= 3 ? "high" : count === 2 ? "medium" : "low";

  if (dispersion > 0.5) {
    confidence = "low";
  } else if (dispersion > 0.25 && confidence === "high") {
    confidence = "medium";
  }

  return confidence;
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
  assertPositiveInteger(week.gameWeek, "gameWeek");
  assertPositiveInteger(week.seasonWeek, "seasonWeek");
  assertDate(week.date);
  assertTrainingType(week.type);
  assertTrainingKind(week.kind);
  assertEfficiency(week.intensity, "intensity");
  assertSkills(week.skills, "skills");
  assertSkillChanges(week.skillsChange);
  assertSupportedSkill(week.skill);
  assertAge(week.playerAge, "playerAge");
  assertSkillLevel(week.skillLevelBefore, "skillLevelBefore");
  assertSkillLevel(week.skillLevelAfter, "skillLevelAfter");
  normalizeSkillLevels(week.skillLevelsBefore, week.skill, week.skillLevelBefore);
  normalizeSkillLevels(week.skillLevelsAfter, week.skill, week.skillLevelAfter);
  assertNonNegativeFinite(week.trainingPoints, "trainingPoints");
  for (const change of week.skillChanges) {
    assertPlayerSkill(change.skill);
    assertSkillLevel(change.before, `skillChanges.${change.skill}.before`);
    assertSkillLevel(change.after, `skillChanges.${change.skill}.after`);
    if (change.delta !== change.after - change.before) {
      throw new Error(`skillChanges.${change.skill}.delta does not match before/after.`);
    }
  }
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
  const targetSkillLevels = [
    ...new Set(observations.map((observation) => observation.toLevel))
  ].sort((left, right) => left - right);

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

function assertTalentObservationPlayer(observation: TalentObservation, playerId: number): void {
  assertSupportedSkill(observation.skill);
  assertPositiveInteger(observation.popWeek, "popWeek");
  assertPositiveFinite(observation.estimatedTalent, "estimatedTalent");

  if (observation.playerId !== playerId || observation.sourceObservation.playerId !== playerId) {
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

function assertDate(value: Date): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error("date must be a valid Date.");
  }
}

function assertTrainingKind(value: TrainingKind): void {
  if (!["advanced", "formation", "missing"].includes(value)) {
    throw new Error("kind must be advanced, formation, or missing.");
  }
}

function assertTrainingType(value: TrainingType): void {
  if (
    ![
      "general",
      "stamina",
      "keeper",
      "playmaking",
      "passing",
      "technique",
      "defending",
      "striker",
      "pace"
    ].includes(value)
  ) {
    throw new Error("Unsupported training type.");
  }
}

function assertSkills(skills: PlayerSkills, fieldName: string): void {
  for (const [skill, level] of Object.entries(skills)) {
    if (level !== undefined) {
      assertPlayerSkill(skill);
      assertSkillLevel(level, `${fieldName}.${skill}`);
    }
  }
}

function assertSkillChanges(changes: PlayerSkillsChange): void {
  assertNonNegativeFinite(changes.up, "skillsChange.up");
  assertNonNegativeFinite(changes.down, "skillsChange.down");

  for (const [skill, change] of Object.entries(changes)) {
    if (skill !== "up" && skill !== "down" && change !== undefined) {
      assertPlayerSkill(skill);
      if (!Number.isInteger(change)) {
        throw new Error(`skillsChange.${skill} must be an integer.`);
      }
    }
  }
}

function assertPlayerSkill(skill: string): asserts skill is PlayerSkill {
  if (
    ![
      "stamina",
      "keeper",
      "playmaking",
      "passing",
      "technique",
      "defending",
      "striker",
      "pace"
    ].includes(skill)
  ) {
    throw new Error(`Unsupported player skill: ${skill}.`);
  }
}

function trainingSkillForType(type: TrainingType): SkillTrainingCostSkill {
  if (type === "striker") {
    return "scoring";
  }

  if (type === "general" || type === "stamina" || type === "keeper") {
    return "pace";
  }

  return type;
}

function skillValue(skills: PlayerSkills, skill: SkillTrainingCostSkill): number | undefined {
  return skills[skill === "scoring" ? "striker" : skill];
}

function skillChangeValue(
  changes: PlayerSkillsChange,
  skill: SkillTrainingCostSkill
): number | undefined {
  return changes[skill === "scoring" ? "striker" : skill];
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

export * from "./recommendations.js";
export * from "./advanced-slots.js";
export * from "./calibration.js";
