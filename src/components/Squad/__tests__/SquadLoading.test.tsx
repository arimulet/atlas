import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Squad } from "../index";

vi.mock("@/components/Training/useWeeklyTrainingIntelligence", () => ({
  useWeeklyTrainingIntelligence: () => ({ data: null, isLoading: false, error: null })
}));

describe("Squad market summary", () => {
  it("shows a loading message instead of zero coverage while planning is pending", () => {
    const html = renderToStaticMarkup(<Squad clubId={null} currency={null} development={null}
      onSelectPlayer={vi.fn()} onSaveSquadRole={vi.fn()} squadPlanning={null}
      squadPlanningStatus="loading" training={null} trainingDiagnostic={null} trainingStatus="loading" />);

    expect(html).toContain("Calculating market values");
    expect(html).not.toContain("0/0");
  });

  it("shows an error when planning fails", () => {
    const html = renderToStaticMarkup(<Squad clubId={null} currency={null} development={null}
      onSelectPlayer={vi.fn()} onSaveSquadRole={vi.fn()} squadPlanning={null}
      squadPlanningStatus="error" training={null} trainingDiagnostic={null} trainingStatus="loading" />);

    expect(html).toContain("Unable to load market values.");
    expect(html).not.toContain("0/0");
  });
});
