import type { Confidence, SkillSet } from "../types.js";
import { DEVELOPMENT_PROJECTION_WEEKS_PER_YEAR } from "../playerDevelopment/projection.js";
import type { DevelopmentProjectionStep, DevelopmentProjectionMilestone } from "../playerDevelopment/index.js";
import { calibratePlayerMarketValue } from "./calibration.js";
import type {
  CalibratedPlayerMarketValueEstimate
} from "./calibration-types.js";
import { estimatePlayerMarketValue } from "./index.js";
import type {
  MarketValueRange,
  PlayerMarketValueContext,
  PlayerMarketValueEstimate,
  PlayerMarketValuePlayerInput
} from "./types.js";
import type {
  FutureMarketValueContext,
  FutureMarketValueMilestone,
  FutureMarketValuePoint,
  FutureMarketValueReason,
  FutureMarketValueCompletion,
  PeakMarketValuePoint,
  PlayerMarketValueProjection,
  PlayerTrainingRoi,
  ProjectedPlayerState,
  TrainingKindMarketValueComparison,
  TrainingPathMarketValueComparison,
  TrainingStepEconomicEvaluation
} from "./future-market-value-types.js";

export const PLAYER_MARKET_VALUE_PROJECTION_MODEL_VERSION =
  "market-value-v1-calibration-v1-training-projection-v1";

export function projectPlayerMarketValue(
  context: FutureMarketValueContext
): PlayerMarketValueProjection {
  validateProjectionContext(context);

  const current = resolveCurrentMarketValue(context);
  const states: ProjectedPlayerState[] = [];
  const points: FutureMarketValuePoint[] = [];
  const reasons: FutureMarketValueReason[] = [];
  let skills = cloneSkills(context.player.skills);
  let previousExpected = current.calibratedValue.expected;

  for (const projectionStep of context.projection.steps) {
    skills = applyProjectionStep(skills, projectionStep);
    const state = stateFromProjectionStep(context, projectionStep, skills);
    states.push(state);

    const valuation = valueProjectedState(context, state);
    const expected = valuation.range?.expected ?? null;
    const valueGainFromCurrent = difference(expected, current.calibratedValue.expected);
    const valueGainFromPrevious = difference(expected, previousExpected);
    const pointConfidence = futureConfidence(
      valuation.confidence,
      projectionStep.confidence,
      projectionStep.cumulativeWeeks,
      context
    );
    const milestone = milestoneAtStep(context.projection.milestones, projectionStep.order);

    points.push({
      step: projectionStep.order,
      gameWeek: projectionStep.estimatedGameWeek,
      estimatedDate: cloneDate(projectionStep.estimatedDate),
      estimatedAge: state.estimatedAge,
      skills: cloneSkills(skills),
      marketValue: cloneRange(valuation.range),
      valueGainFromCurrent,
      valueGainFromPrevious,
      cumulativeTrainingWeeks: finiteOrNull(projectionStep.cumulativeWeeks),
      confidence: pointConfidence,
      ...(milestone ? { milestone } : {})
    });

    if (!valuation.hasComparableEvidence) reasons.push({ type: "future_market_segment_low_evidence" });
    if (valueGainFromPrevious !== null && valueGainFromPrevious < 0) {
      reasons.push({ type: "negative_market_value_return", skill: projectionStep.skill });
      if (valueGainFromCurrent !== null && valueGainFromCurrent < 0) {
        reasons.push({ type: "age_discount_offsets_skill_gain" });
      }
    }

    previousExpected = expected ?? previousExpected;
  }

  const milestones = buildMilestones(context, points, current);
  const completion = buildCompletion(context, points, current);
  const stepEvaluations = buildStepEvaluations(context, points, current);
  const roi = buildTrainingRoi(completion, stepEvaluations, reasons);
  const peak = findPeak(current, points, context.player.age);
  if (peak && peak.step > 0) reasons.push({ type: "projected_peak_value" });
  addStepValueReasons(stepEvaluations, reasons);

  const confidence = projectionConfidence(context, current, points, completion);

  return {
    playerId: context.player.playerId,
    current,
    points,
    milestones,
    completion,
    roi,
    peak,
    confidence,
    reasons: uniqueReasons(reasons),
    modelVersion: PLAYER_MARKET_VALUE_PROJECTION_MODEL_VERSION
  };
}

/** Explicitly named facade for callers interested in training economics. */
export function evaluateTrainingPathEconomics(
  context: FutureMarketValueContext
): PlayerMarketValueProjection {
  return projectPlayerMarketValue(context);
}

export function projectMarketValueAtHorizon(
  context: FutureMarketValueContext,
  horizonWeeks: number
): MarketValueRange {
  if (!Number.isFinite(horizonWeeks) || horizonWeeks < 0) {
    throw new RangeError("Market value horizon must be a finite non-negative number.");
  }

  const projection = projectPlayerMarketValue(context);
  const eligible = projection.points.filter(
    (point) =>
      point.cumulativeTrainingWeeks !== null && point.cumulativeTrainingWeeks <= horizonWeeks
  );
  return cloneRange(eligible.at(-1)?.marketValue) ?? cloneRange(projection.current.calibratedValue)!;
}

export function compareAdvancedAndFormationMarketValue(input: {
  advanced: FutureMarketValueContext;
  formation: FutureMarketValueContext;
  fixedHorizonWeeks?: number | null;
}): TrainingKindMarketValueComparison {
  const advanced = projectPlayerMarketValue(input.advanced);
  const formation = projectPlayerMarketValue(input.formation);
  const fixedHorizonWeeks =
    input.fixedHorizonWeeks === undefined || input.fixedHorizonWeeks === null
      ? null
      : validNonNegative(input.fixedHorizonWeeks, "Fixed horizon");
  const advancedAtHorizon =
    fixedHorizonWeeks === null
      ? null
      : projectMarketValueAtHorizon(input.advanced, fixedHorizonWeeks).expected;
  const formationAtHorizon =
    fixedHorizonWeeks === null
      ? null
      : projectMarketValueAtHorizon(input.formation, fixedHorizonWeeks).expected;

  return {
    advanced,
    formation,
    difference: {
      completionWeeks: difference(
        formation.completion?.estimatedWeeks ?? null,
        advanced.completion?.estimatedWeeks ?? null
      ),
      completionValue: difference(
        advanced.completion?.marketValue?.expected ?? null,
        formation.completion?.marketValue?.expected ?? null
      ),
      valueGeneratedByAdvancedSlot: difference(advancedAtHorizon, formationAtHorizon),
      fixedHorizonWeeks,
      fixedHorizonAdvancedValue: advancedAtHorizon,
      fixedHorizonFormationValue: formationAtHorizon
    }
  };
}

export function compareTrainingPathMarketValue(input: {
  first: FutureMarketValueContext;
  second: FutureMarketValueContext;
}): TrainingPathMarketValueComparison {
  const first = projectPlayerMarketValue(input.first);
  const second = projectPlayerMarketValue(input.second);
  return {
    first,
    second,
    difference: {
      completionWeeks: difference(
        second.completion?.estimatedWeeks ?? null,
        first.completion?.estimatedWeeks ?? null
      ),
      completionValue: difference(
        first.completion?.marketValue?.expected ?? null,
        second.completion?.marketValue?.expected ?? null
      ),
      totalValueGain: difference(first.roi.totalValueGain, second.roi.totalValueGain),
      averageValueGainPerWeek: difference(
        first.roi.averageValueGainPerWeek,
        second.roi.averageValueGainPerWeek
      )
    }
  };
}

export class PlayerMarketProjectionService {
  projectPlayerMarketValue(context: FutureMarketValueContext): PlayerMarketValueProjection {
    return projectPlayerMarketValue(context);
  }

  evaluateTrainingPathEconomics(context: FutureMarketValueContext): PlayerMarketValueProjection {
    return evaluateTrainingPathEconomics(context);
  }

  projectMarketValueAtHorizon(context: FutureMarketValueContext, horizonWeeks: number): MarketValueRange {
    return projectMarketValueAtHorizon(context, horizonWeeks);
  }

  compareAdvancedAndFormationMarketValue(input: {
    advanced: FutureMarketValueContext;
    formation: FutureMarketValueContext;
    fixedHorizonWeeks?: number | null;
  }): TrainingKindMarketValueComparison {
    return compareAdvancedAndFormationMarketValue(input);
  }

  compareTrainingPathMarketValue(input: {
    first: FutureMarketValueContext;
    second: FutureMarketValueContext;
  }): TrainingPathMarketValueComparison {
    return compareTrainingPathMarketValue(input);
  }
}

function validateProjectionContext(context: FutureMarketValueContext): void {
  if (context.path.playerId !== context.player.playerId) {
    throw new Error("Training path playerId does not match the market value player.");
  }
  if (context.projection.playerId !== context.player.playerId) {
    throw new Error("Development projection playerId does not match the market value player.");
  }
  if (context.developmentPlan.target.playerId !== context.player.playerId) {
    throw new Error("Development plan playerId does not match the market value player.");
  }
}

function resolveCurrentMarketValue(context: FutureMarketValueContext): CalibratedPlayerMarketValueEstimate {
  if (context.currentMarketValue) {
    return isCalibratedEstimate(context.currentMarketValue)
      ? context.currentMarketValue
      : wrapFundamentalEstimate(context.currentMarketValue);
  }

  const currentContext = createMarketValueContext(context, context.player);
  if (context.transfers && context.transfers.length > 0) {
    const calibrated = calibratePlayerMarketValue(
      currentContext,
      context.transfers,
      context.comparableOptions
    );
    return calibrated.comparableEstimate ? calibrated : wrapFundamentalEstimate(calibrated.fundamental);
  }
  return wrapFundamentalEstimate(estimatePlayerMarketValue(currentContext));
}

function valueProjectedState(
  context: FutureMarketValueContext,
  state: ProjectedPlayerState
): {
  range: MarketValueRange | null;
  confidence: Confidence;
  hasComparableEvidence: boolean;
} {
  const projectedPlayer: PlayerMarketValuePlayerInput = {
    ...context.player,
    age: state.estimatedAge,
    skills: cloneSkills(state.skills)
  };
  const marketContext = createMarketValueContext(context, projectedPlayer);
  if (context.transfers && context.transfers.length > 0) {
    const calibrated = calibratePlayerMarketValue(
      marketContext,
      context.transfers,
      context.comparableOptions
    );
    const range = calibrated.comparableEstimate
      ? calibrated.calibratedValue
      : calibrated.fundamental.estimatedValue;
    return {
      range,
      confidence: calibrated.confidence,
      hasComparableEvidence: calibrated.comparableEstimate !== null
    };
  }
  const fundamental = estimatePlayerMarketValue(marketContext);
  return {
    range: fundamental.estimatedValue,
    confidence: fundamental.confidence,
    hasComparableEvidence: false
  };
}

function createMarketValueContext(
  context: FutureMarketValueContext,
  player: PlayerMarketValuePlayerInput
): PlayerMarketValueContext {
  return {
    player,
    developmentProfile: context.projection.profile,
    developmentPlan: context.developmentPlan,
    talent: context.talent ?? null
  };
}

function applyProjectionStep(skills: SkillSet, step: DevelopmentProjectionStep): SkillSet {
  return {
    ...skills,
    [step.skill]: clampSkill(step.toLevel)
  };
}

function stateFromProjectionStep(
  context: FutureMarketValueContext,
  step: DevelopmentProjectionStep,
  skills: SkillSet
): ProjectedPlayerState {
  const estimatedAge =
    finiteOrNull(step.estimatedAge) ??
    projectedAgeFromWeeks(context.player.age, step.cumulativeWeeks);
  return {
    playerId: context.player.playerId,
    gameWeek: finiteOrNull(step.estimatedGameWeek),
    estimatedDate: cloneDate(step.estimatedDate),
    estimatedAge,
    skills: cloneSkills(skills),
    completedStep: step.order,
    milestone: milestoneAtStep(context.projection.milestones, step.order)
  };
}

function projectedAgeFromWeeks(age: number | null, weeks: number | null): number | null {
  if (age === null || weeks === null || !Number.isFinite(age) || !Number.isFinite(weeks)) {
    return null;
  }
  return age + weeks / DEVELOPMENT_PROJECTION_WEEKS_PER_YEAR;
}

function buildMilestones(
  context: FutureMarketValueContext,
  points: readonly FutureMarketValuePoint[],
  current: CalibratedPlayerMarketValueEstimate
): FutureMarketValueMilestone[] {
  return context.projection.milestones.map((milestone) => {
    const point = points.find((candidate) => candidate.step === milestone.step);
    return {
      type: milestone.type,
      step: milestone.step,
      gameWeek: finiteOrNull(milestone.estimatedGameWeek),
      age: finiteOrNull(milestone.estimatedAge),
      marketValue: cloneRange(point?.marketValue) ?? cloneRange(milestone.step === 0 ? current.calibratedValue : null),
      valueGainFromCurrent:
        point?.valueGainFromCurrent ??
        (milestone.step === 0 ? 0 : null),
      confidence: point?.confidence ?? milestone.confidence
    };
  });
}

function buildCompletion(
  context: FutureMarketValueContext,
  points: readonly FutureMarketValuePoint[],
  current: CalibratedPlayerMarketValueEstimate
): FutureMarketValueCompletion | null {
  const completion = context.projection.completion;
  if (!completion) return null;
  const lastPoint = points.at(-1);
  const completionAvailable = completion.estimatedWeeks !== null;
  const currentCompletion = completionAvailable && completion.estimatedWeeks === 0 && !lastPoint;
  const marketValue = completionAvailable
    ? cloneRange(lastPoint?.marketValue) ?? (currentCompletion ? cloneRange(current.calibratedValue) : null)
    : null;
  const expected = marketValue?.expected ?? null;
  return {
    estimatedWeeks: finiteOrNull(completion.estimatedWeeks),
    estimatedGameWeek: finiteOrNull(completion.estimatedGameWeek),
    estimatedDate: cloneDate(completion.estimatedDate),
    estimatedAge: finiteOrNull(completion.estimatedAge),
    marketValue,
    valueGain: completionAvailable ? difference(expected, current.calibratedValue.expected) : null,
    confidence: lastPoint?.confidence ?? current.confidence
  };
}

function buildStepEvaluations(
  context: FutureMarketValueContext,
  points: readonly FutureMarketValuePoint[],
  current: CalibratedPlayerMarketValueEstimate
): TrainingStepEconomicEvaluation[] {
  return context.projection.steps.map((step, index) => {
    const point = points[index];
    const before = index === 0 ? current.calibratedValue.expected : points[index - 1]?.marketValue?.expected ?? null;
    const after = point?.marketValue?.expected ?? null;
    const valueGain = difference(after, before);
    const estimatedWeeks = finiteOrNull(step.estimatedWeeks);
    return {
      step: step.order,
      skill: step.skill,
      estimatedWeeks,
      marketValueBefore: before,
      marketValueAfter: after,
      valueGain,
      valueGainPerWeek:
        valueGain !== null && estimatedWeeks !== null && estimatedWeeks > 0
          ? safeNumber(valueGain / estimatedWeeks)
          : null,
      confidence: point?.confidence ?? step.confidence
    };
  });
}

function buildTrainingRoi(
  completion: FutureMarketValueCompletion | null,
  evaluations: readonly TrainingStepEconomicEvaluation[],
  reasons: FutureMarketValueReason[]
): PlayerTrainingRoi {
  const totalValueGain = completion?.valueGain ?? null;
  const totalTrainingWeeks = completion?.estimatedWeeks ?? null;
  const averageValueGainPerWeek =
    totalValueGain !== null && totalTrainingWeeks !== null && totalTrainingWeeks > 0
      ? safeNumber(totalValueGain / totalTrainingWeeks)
      : null;
  const validEvaluations = evaluations.filter(
    (evaluation): evaluation is TrainingStepEconomicEvaluation & { valueGainPerWeek: number } =>
      evaluation.valueGainPerWeek !== null
  );
  const best = validEvaluations.reduce<TrainingStepEconomicEvaluation & { valueGainPerWeek: number } | null>(
    (bestEvaluation, evaluation) =>
      bestEvaluation === null || evaluation.valueGainPerWeek > bestEvaluation.valueGainPerWeek
        ? evaluation
        : bestEvaluation,
    null
  );
  let diminishingReturnPoint: PlayerTrainingRoi["diminishingReturnPoint"] = null;
  for (let index = 1; index < validEvaluations.length; index += 1) {
    const previous = validEvaluations[index - 1]!;
    const current = validEvaluations[index]!;
    if (current.valueGainPerWeek < previous.valueGainPerWeek) {
      diminishingReturnPoint = { step: current.step, skill: current.skill };
      reasons.push({ type: "diminishing_market_return", skill: current.skill });
      break;
    }
  }
  return {
    totalValueGain,
    totalTrainingWeeks,
    averageValueGainPerWeek,
    bestValueStep: best
      ? { step: best.step, skill: best.skill, valueGainPerWeek: best.valueGainPerWeek }
      : null,
    diminishingReturnPoint,
    stepEvaluations: [...evaluations]
  };
}

function addStepValueReasons(
  evaluations: readonly TrainingStepEconomicEvaluation[],
  reasons: FutureMarketValueReason[]
): void {
  const values = evaluations
    .map((evaluation) => evaluation.valueGainPerWeek)
    .filter((value): value is number => value !== null);
  if (values.length === 0) return;
  const average = values.reduce((total, value) => total + value, 0) / values.length;
  for (const evaluation of evaluations) {
    const value = evaluation.valueGainPerWeek;
    if (value === null) continue;
    if (value >= average * 1.25) reasons.push({ type: "high_value_training_step", skill: evaluation.skill });
    if (value < 0) reasons.push({ type: "negative_market_value_return", skill: evaluation.skill });
    else if (value <= average * 0.75) reasons.push({ type: "low_value_training_step", skill: evaluation.skill });
  }
}

function findPeak(
  current: CalibratedPlayerMarketValueEstimate,
  points: readonly FutureMarketValuePoint[],
  currentAge: number | null
): PeakMarketValuePoint | null {
  const candidates: PeakMarketValuePoint[] = [
    { step: 0, age: finiteOrNull(currentAge), value: current.calibratedValue.expected },
    ...points.flatMap((point) =>
      point.marketValue
        ? [{ step: point.step, age: point.estimatedAge, value: point.marketValue.expected }]
        : []
    )
  ];
  return candidates.reduce<PeakMarketValuePoint | null>(
    (peak, candidate) =>
      peak === null || candidate.value > peak.value ? candidate : peak,
    null
  );
}

function projectionConfidence(
  context: FutureMarketValueContext,
  current: CalibratedPlayerMarketValueEstimate,
  points: readonly FutureMarketValuePoint[],
  completion: FutureMarketValueCompletion | null
): Confidence {
  let confidence = minimumConfidence(current.confidence, context.projection.confidence);
  if (context.projection.projectionStatus !== "projected") confidence = minimumConfidence(confidence, "low");
  for (const point of points) confidence = minimumConfidence(confidence, point.confidence);
  if (completion?.estimatedWeeks !== null && (completion?.estimatedWeeks ?? 0) > 26) {
    confidence = minimumConfidence(confidence, "low");
  }
  return confidence;
}

function futureConfidence(
  valuationConfidence: Confidence,
  projectionConfidenceValue: Confidence,
  cumulativeWeeks: number | null,
  context: FutureMarketValueContext
): Confidence {
  let confidence = minimumConfidence(valuationConfidence, projectionConfidenceValue);
  // Future states are hypothetical; calibration can support them, but cannot make them
  // as certain as an observed current state in this iteration.
  confidence = minimumConfidence(confidence, "medium");
  if (
    cumulativeWeeks === null ||
    cumulativeWeeks > 26 ||
    context.projection.projectionStatus !== "projected" ||
    !context.transfers?.length
  ) {
    confidence = minimumConfidence(confidence, "low");
  }
  return confidence;
}

function milestoneAtStep(
  milestones: readonly DevelopmentProjectionMilestone[],
  step: number
): DevelopmentProjectionMilestone["type"] | null {
  return milestones.find((milestone) => milestone.step === step)?.type ?? null;
}

function wrapFundamentalEstimate(
  fundamental: PlayerMarketValueEstimate
): CalibratedPlayerMarketValueEstimate {
  return {
    playerId: fundamental.playerId,
    fundamental,
    comparableEstimate: null,
    calibrationFactor: null,
    calibratedValue: cloneRange(fundamental.estimatedValue)!,
    confidence: fundamental.confidence,
    calibrationStrength: 0,
    reasons: [...fundamental.reasons, { type: "no_comparable_market_evidence" }]
  };
}

function isCalibratedEstimate(
  estimate: CalibratedPlayerMarketValueEstimate | PlayerMarketValueEstimate
): estimate is CalibratedPlayerMarketValueEstimate {
  return "calibratedValue" in estimate;
}

function applyRangeOperation(
  left: number | null,
  right: number | null,
  operation: (left: number, right: number) => number
): number | null {
  if (left === null || right === null) return null;
  return safeNumber(operation(left, right));
}

function difference(left: number | null, right: number | null): number | null {
  return applyRangeOperation(left, right, (leftValue, rightValue) => leftValue - rightValue);
}

function cloneSkills(skills: SkillSet): SkillSet {
  return { ...skills };
}

function cloneDate(date: Date | null | undefined): Date | null {
  return date instanceof Date && Number.isFinite(date.getTime()) ? new Date(date.getTime()) : null;
}

function cloneRange(range: MarketValueRange | null | undefined): MarketValueRange | null {
  if (!range) return null;
  const expected = nonNegative(range.expected);
  const low = Math.min(nonNegative(range.low), expected);
  const high = Math.max(nonNegative(range.high), expected);
  return { low, expected, high };
}

function clampSkill(value: number): number {
  return Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), 20);
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function nonNegative(value: number): number {
  return Math.max(0, safeNumber(value));
}

function validNonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${label} must be finite and non-negative.`);
  return value;
}

function minimumConfidence(left: Confidence, right: Confidence): Confidence {
  const rank: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
  return rank[left] <= rank[right] ? left : right;
}

function uniqueReasons(reasons: readonly FutureMarketValueReason[]): FutureMarketValueReason[] {
  const seen = new Set<string>();
  return reasons.filter((reason) => {
    const key = JSON.stringify(reason);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
