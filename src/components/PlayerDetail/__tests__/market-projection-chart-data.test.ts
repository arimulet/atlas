import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { DevelopmentPlanPathRow } from "../development-plan-view-model";
import { createMarketProjectionChartData } from "../market-projection-chart-data";
import { MarketProjectionChartTooltip } from "../PlayerDevelopmentPlan";

const path: DevelopmentPlanPathRow[] = [
  {
    order: 1,
    skill: "defender",
    fromLevel: 10,
    toLevel: 11,
    priority: "primary",
    estimatedWeeks: 4,
    cumulativeWeeks: 4,
    estimatedGameWeek: 1204,
    estimatedAge: 18.1,
    confidence: "high",
    isCurrent: true,
    reasons: []
  }
];

const formatSkill = (skill: DevelopmentPlanPathRow["skill"]): string =>
  skill === "defender" ? "Defending" : skill;

describe("createMarketProjectionChartData", () => {
  it("includes the current and projected minimum, expected and maximum values", () => {
    const data = createMarketProjectionChartData({
      currentMarketValue: {
        expected: { value: 2_000_000, label: "$2,000,000" },
        range: {
          low: { value: 1_700_000, label: "$1,700,000" },
          expected: { value: 2_000_000, label: "$2,000,000" },
          high: { value: 2_300_000, label: "$2,300,000" },
          label: "$1,700,000 – $2,300,000"
        },
        confidence: { level: "high", label: "High confidence" }
      },
      formatSkill,
      path,
      points: [
        {
          step: 1,
          label: "Step 1",
          value: { value: 2_500_000, label: "$2,500,000" },
          range: {
            low: { value: 2_100_000, label: "$2,100,000" },
            expected: { value: 2_500_000, label: "$2,500,000" },
            high: { value: 2_900_000, label: "$2,900,000" },
            label: "$2,100,000 – $2,900,000"
          },
          weeks: 4,
          age: "~18.1",
          confidence: { level: "high", label: "High confidence" },
          basedOnFundamentalOnly: false
        }
      ]
    });

    expect(data).toEqual([
      expect.objectContaining({
        label: "Step 0 · Current",
        value: 2_000_000,
        minimumValue: 1_700_000,
        minimumValueLabel: "$1,700,000",
        maximumValue: 2_300_000,
        maximumValueLabel: "$2,300,000",
        tooltipLabel: "Step 0 · Current Value"
      }),
      expect.objectContaining({
        label: "Step 1 · Defending",
        value: 2_500_000,
        minimumValue: 2_100_000,
        minimumValueLabel: "$2,100,000",
        maximumValue: 2_900_000,
        maximumValueLabel: "$2,900,000",
        tooltipLabel: "Step 1 · Defending 10 → 11"
      })
    ]);
  });

  it("includes projected Sokker skills for Step 0 and projected steps in the chart tooltip", () => {
    const stepWithSkills: DevelopmentPlanPathRow = {
      ...path[0]!,
      projectedSkills: {
        stamina: 6,
        keeper: 0,
        pace: 8,
        defender: 11,
        technique: 7,
        playmaker: 5,
        passing: 6,
        striker: 4
      }
    };

    const data = createMarketProjectionChartData({
      currentMarketValue: {
        expected: { value: 2_000_000, label: "$2,000,000" },
        range: null,
        confidence: { level: "high", label: "High confidence" }
      },
      formatSkill,
      path: [stepWithSkills],
      points: [
        {
          step: 1,
          label: "Step 1",
          value: { value: 2_500_000, label: "$2,500,000" },
          range: null,
          weeks: 4,
          age: "~18.1",
          confidence: { level: "high", label: "High confidence" },
          basedOnFundamentalOnly: false
        }
      ]
    });

    expect(data[0]?.projectedSkills?.defender).toBe(10);
    expect(data[1]?.projectedSkills?.defender).toBe(11);
    expect(data[0]?.timelineLabel).toBe("Age 18.1 · W4");
    expect(data[1]?.timelineLabel).toBe("Age 18.1 · W8");

    const tooltipHtml = renderToStaticMarkup(
      MarketProjectionChartTooltip({ active: true, payload: [{ payload: data[1] }] })
    );

    expect(tooltipHtml).toContain("stamina");
    expect(tooltipHtml).toContain("adequate [6]");
    expect(tooltipHtml).toContain("defender");
    expect(tooltipHtml).toContain("formidable [11]");
    expect(tooltipHtml).toContain("is-trained");
  });

  it("leaves the range lines empty when a projected step has no range", () => {
    const data = createMarketProjectionChartData({
      currentMarketValue: null,
      formatSkill,
      path: [],
      points: [
        {
          step: 1,
          label: "Step 1",
          value: { value: 2_500_000, label: "$2,500,000" },
          range: null,
          weeks: null,
          age: "—",
          confidence: { level: "low", label: "Low confidence" },
          basedOnFundamentalOnly: true
        }
      ]
    });

    expect(data).toEqual([
      expect.objectContaining({
        value: 2_500_000,
        minimumValue: null,
        minimumValueLabel: null,
        maximumValue: null,
        maximumValueLabel: null,
        valueLabel: "$2,500,000",
        tooltipLabel: "Step 1"
      })
    ]);
  });
});
