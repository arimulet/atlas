import type {
  CalibratedPlayerMarketValueEstimate,
  ComparableDifference,
  DevelopmentProfile,
  FutureMarketValuePoint,
  FutureMarketValueReason,
  MarketComparable,
  MarketValueRange,
  PlayerMarketValueReason,
  PlayerMarketValueProjection,
  SquadDepthPlayer,
  SkillKey,
  TrainingKindMarketValueComparison
} from "@atlas/domain";
import type { MoneyTotal } from "@atlas/web/app/types";
import { formatMoney } from "../formatters";

const MAX_VISIBLE_COMPARABLES = 5;

export interface MarketValueAmount {
  value: number;
  label: string;
}

export interface MarketValueRangeViewModel {
  low: MarketValueAmount;
  expected: MarketValueAmount;
  high: MarketValueAmount;
  label: string;
}

export interface MarketComparableViewModel {
  age: number;
  profile: string;
  keySkills: string;
  similarity: string;
  salePrice: MarketValueAmount;
  date: string;
  differences: string[];
  isOutlier: boolean;
}

export interface PlayerMarketValueViewModel {
  current: {
    expected: MarketValueAmount;
    range: MarketValueRangeViewModel;
    confidence: ConfidenceViewModel;
    sokkerValue: MarketValueAmount | null;
    fundamental: MarketValueAmount;
    calibrated: MarketValueAmount;
    basedOnFundamentalOnly: boolean;
  };
  evidence: {
    sampleSize: number;
    strongMatches: number;
    confidence: ConfidenceViewModel;
    estimate: MarketValueRangeViewModel | null;
    observedRange: { low: MarketValueAmount; high: MarketValueAmount } | null;
    weightedAverage: MarketValueAmount | null;
    weightedMedian: MarketValueAmount | null;
    comparables: MarketComparableViewModel[];
    outliersExcluded: number;
  };
  reasons: string[];
  projection: {
    current: MarketValueAmount;
    nextSkillUp: ProjectionPointViewModel | null;
    targetCompletion: ProjectionPointViewModel | null;
    peak: { value: MarketValueAmount; age: string; step: number } | null;
    points: ProjectionPointViewModel[];
    confidence: ConfidenceViewModel;
  } | null;
  training: TrainingValueViewModel | null;
  advancedImpact: AdvancedImpactViewModel | null;
}

export interface ConfidenceViewModel {
  level: "low" | "medium" | "high";
  label: string;
}

export interface ProjectionPointViewModel {
  step: number;
  label: string;
  value: MarketValueAmount;
  range: MarketValueRangeViewModel | null;
  gainFromCurrent: MarketValueAmount | null;
  gainFromPrevious: MarketValueAmount | null;
  weeks: number | null;
  age: string;
  confidence: ConfidenceViewModel;
  milestone: string | null;
}

export interface TrainingValueViewModel {
  totalValueGain: MarketValueAmount | null;
  totalTrainingWeeks: string;
  averageValueGainPerWeek: MarketValueAmount | null;
  steps: TrainingStepViewModel[];
  diminishingReturn: string | null;
  negativeReturn: boolean;
}

export interface TrainingStepViewModel {
  step: number;
  label: string;
  estimatedWeeks: string;
  valueGain: MarketValueAmount | null;
  valueGainPerWeek: MarketValueAmount | null;
  confidence: ConfidenceViewModel;
}

export interface AdvancedImpactViewModel {
  horizonWeeks: number | null;
  advancedValue: MarketValueAmount | null;
  formationValue: MarketValueAmount | null;
  advancedSlotValue: MarketValueAmount | null;
  completionWeeks: string;
  completionValue: MarketValueAmount | null;
}

export interface SquadMarketValueSummaryViewModel {
  currentTotal: MarketValueAmount;
  projectedTotal: MarketValueAmount;
  potentialValueCreation: MarketValueAmount;
  breakdown: Array<{ role: string; value: MarketValueAmount }>;
  topAssets: Array<{ playerId: string; name: string; value: MarketValueAmount }>;
  coverage: { valued: number; total: number; comparableBacked: number };
}

export function createPlayerMarketValueViewModel(
  player: SquadDepthPlayer,
  currency: string | null
): PlayerMarketValueViewModel | null {
  const marketValue = player.marketValue ?? null;
  if (!marketValue) return null;

  const comparableEstimate = marketValue.comparableEstimate;
  const currentRange = createRangeViewModel(marketValue.calibratedValue, currency);
  const fundamental = amount(marketValue.fundamental.estimatedValue.expected, currency);
  const calibrated = amount(marketValue.calibratedValue.expected, currency);

  return {
    current: {
      expected: calibrated,
      range: currentRange,
      confidence: confidence(marketValue.confidence),
      sokkerValue:
        marketValue.fundamental.sokkerValue === null
          ? null
          : amount(marketValue.fundamental.sokkerValue, currency),
      fundamental,
      calibrated,
      basedOnFundamentalOnly: comparableEstimate === null
    },
    evidence: createEvidenceViewModel(comparableEstimate, currency),
    reasons: marketValue.reasons.map(reasonLabel),
    projection: createProjectionViewModel(player, marketValue, currency),
    training: createTrainingValueViewModel(player.marketProjection, currency),
    advancedImpact: createAdvancedImpactViewModel(player.marketTrainingComparison, currency)
  };
}

export function formatMarketRange(range: MarketValueRangeViewModel): string {
  return `${range.low.label} – ${range.high.label}`;
}

export function createSquadMarketValueSummary(
  players: readonly SquadDepthPlayer[],
  currency: string | null
): SquadMarketValueSummaryViewModel {
  const entries = players.map((player) => ({
    player,
    value: player.marketValue ? createPlayerMarketValueViewModel(player, currency) : null
  }));
  const valued = entries.filter(
    (entry): entry is typeof entry & { value: PlayerMarketValueViewModel } => entry.value !== null
  );
  const currentTotal = valued.reduce(
    (total, entry) => total + entry.value.current.expected.value,
    0
  );
  const projectedTotal = valued.reduce(
    (total, entry) =>
      total +
      (entry.value.projection?.targetCompletion?.value.value ?? entry.value.current.expected.value),
    0
  );
  const roleTotals = new Map<string, number>();
  for (const entry of valued) {
    roleTotals.set(
      entry.player.role,
      (roleTotals.get(entry.player.role) ?? 0) + entry.value.current.expected.value
    );
  }
  const topAssets = [...valued]
    .sort((left, right) => right.value.current.expected.value - left.value.current.expected.value)
    .slice(0, 5)
    .map((entry) => ({
      playerId: String(entry.player.playerId),
      name: entry.player.playerName ?? `Player ${entry.player.playerId}`,
      value: entry.value.current.expected
    }));

  return {
    currentTotal: amount(valued.length === 0 ? null : currentTotal, currency),
    projectedTotal: amount(valued.length === 0 ? null : projectedTotal, currency),
    potentialValueCreation: amount(
      valued.length === 0 ? null : projectedTotal - currentTotal,
      currency
    ),
    breakdown: [...roleTotals.entries()].map(([role, value]) => ({
      role: roleLabel(role),
      value: amount(value, currency)
    })),
    topAssets,
    coverage: {
      valued: valued.length,
      total: players.length,
      comparableBacked: valued.filter((entry) => !entry.value.current.basedOnFundamentalOnly).length
    }
  };
}

export function formatMarketMoney(value: number | null, currency: string | null): string {
  return formatMoney(toMoneyTotal(value, currency));
}

export function confidenceLabel(value: "low" | "medium" | "high"): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)} confidence`;
}

function createEvidenceViewModel(
  estimate: CalibratedPlayerMarketValueEstimate["comparableEstimate"],
  currency: string | null
): PlayerMarketValueViewModel["evidence"] {
  if (!estimate) {
    return {
      sampleSize: 0,
      strongMatches: 0,
      confidence: confidence("low"),
      estimate: null,
      observedRange: null,
      weightedAverage: null,
      weightedMedian: null,
      comparables: [],
      outliersExcluded: 0
    };
  }

  const prices = estimate.comparables
    .filter((comparable) => !comparable.outlier)
    .map((comparable) => comparable.normalizedSalePrice);
  const sortedPrices = [...prices].sort((left, right) => left - right);

  return {
    sampleSize: estimate.sampleSize,
    strongMatches: estimate.comparables.filter((comparable) => comparable.similarityScore >= 0.85)
      .length,
    confidence: confidence(estimate.confidence),
    estimate: estimate.estimatedValue
      ? createRangeViewModel(estimate.estimatedValue, currency)
      : null,
    observedRange:
      sortedPrices.length === 0
        ? null
        : {
            low: amount(sortedPrices[0]!, currency),
            high: amount(sortedPrices.at(-1)!, currency)
          },
    weightedAverage:
      estimate.weightedAverage === null ? null : amount(estimate.weightedAverage, currency),
    weightedMedian:
      estimate.weightedMedian === null ? null : amount(estimate.weightedMedian, currency),
    comparables: estimate.comparables
      .slice(0, MAX_VISIBLE_COMPARABLES)
      .map((comparable) => createComparableViewModel(comparable, currency)),
    outliersExcluded: estimate.outliers.length
  };
}

function createComparableViewModel(
  comparable: MarketComparable,
  currency: string | null
): MarketComparableViewModel {
  return {
    age: comparable.transfer.age,
    profile: profileLabel(comparable.transfer.developmentProfile),
    keySkills: keySkillsLabel(comparable),
    similarity: `${Math.round(comparable.similarityScore * 100)}%`,
    salePrice: amount(comparable.normalizedSalePrice, currency),
    date: comparableDateLabel(comparable.transfer.transferDate),
    differences: comparable.differences.map(comparableDifferenceLabel).slice(0, 4),
    isOutlier: comparable.outlier !== undefined
  };
}

function createProjectionViewModel(
  player: SquadDepthPlayer,
  marketValue: CalibratedPlayerMarketValueEstimate,
  currency: string | null
): PlayerMarketValueViewModel["projection"] {
  const projection = player.marketProjection;
  if (!projection) return null;

  const points = projection.points.map((point) => createPointViewModel(point, currency));
  const lastPoint = points.at(-1) ?? null;
  const completionPoint = projection.completion?.marketValue
    ? createPointViewModel(
        {
          step: projection.points.at(-1)?.step ?? 0,
          gameWeek: projection.completion.estimatedGameWeek,
          estimatedDate: projection.completion.estimatedDate,
          estimatedAge: projection.completion.estimatedAge,
          skills: projection.points.at(-1)?.skills ?? {},
          marketValue: projection.completion.marketValue,
          valueGainFromCurrent: projection.completion.valueGain,
          valueGainFromPrevious: null,
          cumulativeTrainingWeeks: projection.completion.estimatedWeeks,
          confidence: projection.completion.confidence,
          milestone: "development_target_completed"
        },
        currency
      )
    : lastPoint;

  return {
    current: amount(marketValue.calibratedValue.expected, currency),
    nextSkillUp: points[0] ?? null,
    targetCompletion: completionPoint,
    peak: projection.peak
      ? {
          value: amount(projection.peak.value, currency),
          age: formatAge(projection.peak.age),
          step: projection.peak.step
        }
      : null,
    points,
    confidence: confidence(projection.confidence)
  };
}

function createPointViewModel(
  point: FutureMarketValuePoint,
  currency: string | null
): ProjectionPointViewModel {
  return {
    step: point.step,
    label: point.milestone ? milestoneLabel(point.milestone) : `Step ${point.step}`,
    value: amount(point.marketValue?.expected ?? null, currency),
    range: point.marketValue ? createRangeViewModel(point.marketValue, currency) : null,
    gainFromCurrent:
      point.valueGainFromCurrent === null ? null : amount(point.valueGainFromCurrent, currency),
    gainFromPrevious:
      point.valueGainFromPrevious === null ? null : amount(point.valueGainFromPrevious, currency),
    weeks: point.cumulativeTrainingWeeks,
    age: formatAge(point.estimatedAge),
    confidence: confidence(point.confidence),
    milestone: point.milestone ? milestoneLabel(point.milestone) : null
  };
}

function createTrainingValueViewModel(
  projection: PlayerMarketValueProjection | null | undefined,
  currency: string | null
): TrainingValueViewModel | null {
  if (!projection) return null;
  return {
    totalValueGain:
      projection.roi.totalValueGain === null
        ? null
        : amount(projection.roi.totalValueGain, currency),
    totalTrainingWeeks: formatWeeks(projection.roi.totalTrainingWeeks),
    averageValueGainPerWeek:
      projection.roi.averageValueGainPerWeek === null
        ? null
        : amount(projection.roi.averageValueGainPerWeek, currency),
    steps: projection.roi.stepEvaluations.map((step) => ({
      step: step.step,
      label: `${skillLabel(step.skill)} training`,
      estimatedWeeks: formatWeeks(step.estimatedWeeks),
      valueGain: step.valueGain === null ? null : amount(step.valueGain, currency),
      valueGainPerWeek:
        step.valueGainPerWeek === null ? null : amount(step.valueGainPerWeek, currency),
      confidence: confidence(step.confidence)
    })),
    diminishingReturn: projection.roi.diminishingReturnPoint
      ? `Economic return begins to decline after ${skillLabel(projection.roi.diminishingReturnPoint.skill)}.`
      : null,
    negativeReturn: projection.roi.stepEvaluations.some(
      (step) => step.valueGainPerWeek !== null && step.valueGainPerWeek < 0
    )
  };
}

function createAdvancedImpactViewModel(
  comparison: TrainingKindMarketValueComparison | null | undefined,
  currency: string | null
): AdvancedImpactViewModel | null {
  if (!comparison) return null;
  const difference = comparison.difference;
  const hasFixedHorizon = difference.fixedHorizonWeeks !== null;
  const hasCompletion = difference.completionValue !== null || difference.completionWeeks !== null;
  if (!hasFixedHorizon && !hasCompletion) return null;
  return {
    horizonWeeks: difference.fixedHorizonWeeks,
    advancedValue:
      difference.fixedHorizonAdvancedValue === null
        ? null
        : amount(difference.fixedHorizonAdvancedValue, currency),
    formationValue:
      difference.fixedHorizonFormationValue === null
        ? null
        : amount(difference.fixedHorizonFormationValue, currency),
    advancedSlotValue:
      difference.valueGeneratedByAdvancedSlot === null
        ? null
        : amount(difference.valueGeneratedByAdvancedSlot, currency),
    completionWeeks: formatSignedWeeks(difference.completionWeeks),
    completionValue:
      difference.completionValue === null ? null : amount(difference.completionValue, currency)
  };
}

function createRangeViewModel(
  range: MarketValueRange,
  currency: string | null
): MarketValueRangeViewModel {
  const low = amount(range.low, currency);
  const expected = amount(range.expected, currency);
  const high = amount(range.high, currency);
  return { low, expected, high, label: `${low.label} – ${high.label}` };
}

function amount(value: number | null, currency: string | null): MarketValueAmount {
  return { value: value ?? 0, label: formatMarketMoney(value, currency) };
}

function toMoneyTotal(value: number | null, currency: string | null): MoneyTotal | null {
  return value === null ? null : { amount: value, currency, isComplete: true };
}

function confidence(value: "low" | "medium" | "high"): ConfidenceViewModel {
  return { level: value, label: confidenceLabel(value) };
}

function reasonLabel(reason: PlayerMarketValueReason | FutureMarketValueReason): string {
  switch (reason.type) {
    case "elite_primary_skill":
      return `Elite ${skillLabel(reason.skill)} level`;
    case "young_age_premium":
      return "Strong age premium";
    case "age_discount":
      return "Age discount applies";
    case "strong_skill_distribution":
      return "Balanced skill distribution";
    case "high_development_upside":
      return "High development upside";
    case "limited_development_upside":
      return "Limited development upside";
    case "profile_fallback_used":
      return "Profile inferred from available data";
    case "incomplete_data":
      return "Incomplete player data";
    case "talent_low_confidence":
      return "Talent estimate has low confidence";
    case "comparable_market_evidence":
      return `${reason.sampleSize} comparable sales support the estimate`;
    case "no_comparable_market_evidence":
      return "Based on fundamental valuation";
    case "market_premium":
      return "Comparable market premium";
    case "market_discount":
      return "Comparable market discount";
    case "high_price_dispersion":
      return "Comparable sale prices are dispersed";
    case "high_value_training_step":
      return `High-value ${skillLabel(reason.skill)} training step`;
    case "low_value_training_step":
      return `Low-value ${skillLabel(reason.skill)} training step`;
    case "diminishing_market_return":
      return `Diminishing return after ${skillLabel(reason.skill)}`;
    case "negative_market_value_return":
      return `Negative market-value return on ${skillLabel(reason.skill)}`;
    case "age_discount_offsets_skill_gain":
      return "Age discount offsets the skill gain";
    case "advanced_training_value":
      return "Advanced training creates additional market value";
    case "future_market_segment_low_evidence":
      return "Future market segment has limited evidence";
    case "projected_peak_value":
      return "Projected peak market value";
    default:
      return "Market value driver";
  }
}

function comparableDifferenceLabel(difference: ComparableDifference): string {
  switch (difference.type) {
    case "age":
      return `Age ${difference.target} vs ${difference.comparable}`;
    case "skill":
      return `${skillLabel(difference.skill)} ${difference.target} vs ${difference.comparable}`;
    case "profile":
      return `Profile ${profileLabel(difference.target)} vs ${profileLabel(difference.comparable)}`;
  }
}

function keySkillsLabel(comparable: MarketComparable): string {
  return (
    comparable.differences
      .filter(
        (difference): difference is Extract<ComparableDifference, { type: "skill" }> =>
          difference.type === "skill"
      )
      .slice(0, 3)
      .map((difference) => `${skillLabel(difference.skill)} ${difference.comparable}`)
      .join(" · ") || "—"
  );
}

function profileLabel(profile: DevelopmentProfile | null | undefined): string {
  if (!profile) return "Unknown profile";
  return profile.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function skillLabel(skill: SkillKey): string {
  const labels: Record<SkillKey, string> = {
    stamina: "Stamina",
    pace: "Pace",
    technique: "Technique",
    passing: "Passing",
    keeper: "Keeper",
    defender: "Defending",
    playmaker: "Playmaking",
    striker: "Scoring"
  };
  return labels[skill];
}

function milestoneLabel(value: string): string {
  if (value === "primary_skills_completed") return "Primary skills complete";
  if (value === "development_target_completed") return "Development target";
  return "Skill target complete";
}

function formatAge(value: number | null): string {
  return value === null ? "—" : `~${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}`;
}

function comparableDateLabel(value: Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("en-US") : "—";
}

function formatWeeks(value: number | null): string {
  return value === null ? "—" : `~${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}w`;
}

function formatSignedWeeks(value: number | null): string {
  return value === null
    ? "—"
    : `${value >= 0 ? "+" : ""}${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}w`;
}
