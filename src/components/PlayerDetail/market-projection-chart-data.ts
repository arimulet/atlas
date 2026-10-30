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
}

export function createMarketProjectionChartData({
  currentMarketValue,
  formatSkill,
  path,
  points
}: CreateMarketProjectionChartDataInput): MarketProjectionChartDatum[] {
  const pathByStep = new Map(path.map((step) => [step.order, step]));
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
        timelineLabel: projectionTimelineLabel(points[0]?.age ?? "—", 0),
        confidence: currentMarketValue.confidence.label,
        basedOnFundamentalOnly: currentMarketValue.basedOnFundamentalOnly ?? false
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
      timelineLabel: projectionTimelineLabel(point.age, point.weeks),
      confidence: point.confidence.label,
      basedOnFundamentalOnly: point.basedOnFundamentalOnly ?? false
    };
  });

  return currentDatum ? [currentDatum, ...projectedData] : projectedData;
}

function projectionTimelineLabel(age: string, weeks: number | null): string {
  const displayedAge = age === "—" ? "Age unavailable" : `Age ${age.replace(/^~/, "")}`;

  if (weeks === null) return displayedAge;

  return `${displayedAge} · ${weeks.toLocaleString("en-US", { maximumFractionDigits: 1 })} weeks`;
}
