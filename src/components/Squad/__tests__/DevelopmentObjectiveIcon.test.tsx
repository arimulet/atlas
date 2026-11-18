import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { SquadDepthPlayer } from "@atlas/domain";
import { DevelopmentObjectiveIcon } from "../DevelopmentObjectiveIcon";
import { SquadPlanningRoleControl } from "../SquadPlanningRoleControl";

describe("DevelopmentObjectiveIcon", () => {
  it.each([
    ["sportive", "Sportive", "⚽"],
    ["financial", "Financial", "💰"]
  ] as const)("shows an accessible %s icon with a tooltip", (objective, label, icon) => {
    const html = renderToStaticMarkup(<DevelopmentObjectiveIcon objective={objective} />);

    expect(html).toContain(`aria-label="Saved development objective: ${label}"`);
    expect(html).toContain(`title="${label}"`);
    expect(html).toContain(`>${icon}</span>`);
  });

  it("shows nothing when there is no saved objective", () => {
    expect(renderToStaticMarkup(<DevelopmentObjectiveIcon objective={null} />)).toBe("");
  });

  it("reflects the current saved objective in the planning cell after changes", () => {
    const player: SquadDepthPlayer = {
      playerId: 1, role: "developing", source: "automatic", automaticRole: "developing",
      manualRole: null, lifecycle: "development", profile: null, currentContributionScore: null,
      futureContributionScore: null, developmentPotentialScore: null,
      currentContributionPercentile: null, confidence: "low", reasons: []
    };
    const renderPlanning = (objective: SquadDepthPlayer["configuredDevelopmentObjective"]) =>
      renderToStaticMarkup(<SquadPlanningRoleControl onSaveSquadRole={vi.fn()} playerId="1"
        playerName="Player" planningPlayer={{ ...player, configuredDevelopmentObjective: objective }} />);

    expect(renderPlanning("sportive")).toContain('title="Sportive"');
    expect(renderPlanning("financial")).toContain('title="Financial"');
    expect(renderPlanning(null)).not.toContain("Saved development objective");
  });
});
