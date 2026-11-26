import { normalizeSeasonWeek } from "@atlas/domain";
import type {
  ConfidenceViewModel,
  MarketValueAmount,
  MarketValueRangeViewModel,
  ProjectionPointViewModel
} from "@/app/view-models/market-value-view-model";
import type { DevelopmentPlanPathRow } from "./development-plan-view-model";

type MarketProjectionChartPoint = Pick<
  ProjectionPointViewModel,
  "age" | "basedOnFundamentalOnly" | "confidence" | "label" | "range" | "step" | "value" | "weeks"
>;

interface MarketProjectionChartCurrentValue {
  expected: MarketValueAmount;
  range: MarketValueRangeViewModel | null;
  confidence: ConfidenceViewModel;
  basedOnFundamentalOnly?: boolean;
}

interface CreateMarketProjectionChartDataInput {
  currentMarketValue: MarketProjectionChartCurrentValue | null | undefined;
  currentSkills?: Record<string, number> | null;
  formatSkill: (skill: DevelopmentPlanPathRow["skill"]) => string;
  path: readonly DevelopmentPlanPathRow[];
  points: readonly MarketProjectionChartPoint[];
}

export interface MarketProjectionChartDatum {
  label: string;
  tooltipLabel: string;
  value: number;
  valueLabel: string;
  minimumValue: number | null;
  minimumValueLabel: string | null;
  maximumValue: number | null;
  maximumValueLabel: string | null;
  timelineLabel: string;
  confidence: string;
  basedOnFundamentalOnly: boolean;
  projectedSkills: Record<string, number> | null;
  trainedSkill: DevelopmentPlanPathRow["skill"] | null;
}

export function createMarketProjectionChartData({
  currentMarketValue,
  currentSkills,
  formatSkill,
  path,
  points
}: CreateMarketProjectionChartDataInput): MarketProjectionChartDatum[] {
  const pathByStep = new Map(path.map((step) => [step.order, step]));
  const firstStep = path[0];
  const currentGameWeek =
    firstStep?.estimatedGameWeek !== null &&
    firstStep?.estimatedGameWeek !== undefined &&
    firstStep?.cumulativeWeeks !== null &&
    firstStep?.cumulativeWeeks !== undefined
      ? Math.round(firstStep.estimatedGameWeek - firstStep.cumulativeWeeks)
      : null;
  const step0Skills = resolveCurrentSkills(currentSkills, firstStep);
  const currentDatum = currentMarketValue
    ? {
        label: "Step 0 · Current",
        tooltipLabel: "Step 0 · Current Value",
        value: currentMarketValue.expected.value,
        valueLabel: currentMarketValue.expected.label,
        minimumValue: currentMarketValue.range?.low.value ?? null,
        minimumValueLabel: currentMarketValue.range?.low.label ?? null,
        maximumValue: currentMarketValue.range?.high.value ?? null,
        maximumValueLabel: currentMarketValue.range?.high.label ?? null,
        timelineLabel: projectionTimelineLabel(points[0]?.age ?? "—", currentGameWeek),
        confidence: currentMarketValue.confidence.label,
        basedOnFundamentalOnly: currentMarketValue.basedOnFundamentalOnly ?? false,
        projectedSkills: step0Skills,
        trainedSkill: null
      }
    : null;

  const projectedData = points.map((point) => {
    const trainingStep = pathByStep.get(point.step);
    const trainedSkillLabel = trainingStep
      ? `${formatSkill(trainingStep.skill)} ${trainingStep.fromLevel} → ${trainingStep.toLevel}`
      : null;

    return {
      label: trainingStep ? `Step ${point.step} · ${formatSkill(trainingStep.skill)}` : point.label,
      tooltipLabel: trainedSkillLabel ? `${point.label} · ${trainedSkillLabel}` : point.label,
      value: point.value.value,
      valueLabel: point.value.label,
      minimumValue: point.range?.low.value ?? null,
      minimumValueLabel: point.range?.low.label ?? null,
      maximumValue: point.range?.high.value ?? null,
      maximumValueLabel: point.range?.high.label ?? null,
      timelineLabel: projectionTimelineLabel(point.age, trainingStep?.estimatedGameWeek ?? null),
      confidence: point.confidence.label,
      basedOnFundamentalOnly: point.basedOnFundamentalOnly ?? false,
      projectedSkills: trainingStep?.projectedSkills ?? null,
      trainedSkill: trainingStep?.skill ?? null
    };
  });

  return currentDatum ? [currentDatum, ...projectedData] : projectedData;
}

function resolveCurrentSkills(
  currentSkills: Record<string, number> | null | undefined,
  firstStep: DevelopmentPlanPathRow | undefined
): Record<string, number> | null {
  if (currentSkills && Object.keys(currentSkills).length > 0) {
    return currentSkills;
  }

  if (!firstStep?.projectedSkills) {
    return null;
  }

  const derived = { ...firstStep.projectedSkills };
  derived[firstStep.skill] = firstStep.fromLevel;
  for (const residual of firstStep.residualChanges ?? []) {
    derived[residual.skill] = residual.fromLevel;
  }

  return derived;
}

function projectionTimelineLabel(age: string, gameWeek: number | null): string {
  const displayedAge = age === "—" ? "Age unavailable" : `Age ${age.replace(/^~/, "")}`;

  if (gameWeek === null) return displayedAge;

  return `${displayedAge} · W${normalizeSeasonWeek(gameWeek)}`;
}
