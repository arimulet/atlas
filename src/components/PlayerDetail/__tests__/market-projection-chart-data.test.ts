import { describe, expect, it } from "vitest";
import type { DevelopmentPlanPathRow } from "../development-plan-view-model";
import { createMarketProjectionChartData } from "../market-projection-chart-data";

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
