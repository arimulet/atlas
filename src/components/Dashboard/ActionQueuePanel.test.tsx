import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ActionQueueItem } from "./action-queue-view-model";
import { ActionQueuePanel } from "./ActionQueuePanel";

describe("ActionQueuePanel", () => {
  it("renders the compact queue grouped by horizon and exposes the expansion control", () => {
    const html = renderToStaticMarkup(
      <ActionQueuePanel
        financialStatus="ready"
        items={createActions(6)}
        onNavigateToView={vi.fn()}
        onSelectPlayer={vi.fn()}
        squadStatus="ready"
      />
    );

    expect(html).toContain("Action queue");
    expect(html).toContain("Now");
    expect(html).toContain("Next season");
    expect(html).toContain("View all actions (1 more)");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Action 5");
    expect(html).not.toContain("Action 6");
  });

  it("renders player and module CTAs and reports unavailable sources without hiding actions", () => {
    const html = renderToStaticMarkup(
      <ActionQueuePanel
        financialStatus="error"
        items={[
          createAction({
            id: "player-action",
            players: [{ id: "42", name: "Action Player", countryName: "Argentina" }],
            destination: { kind: "player", playerId: "42" }
          }),
          createAction({
            id: "squad-action",
            destination: { kind: "view", view: "squad" }
          })
        ]}
        onNavigateToView={vi.fn()}
        onSelectPlayer={vi.fn()}
        squadStatus="ready"
      />
    );

    expect(html).toContain("View player");
    expect(html).toContain("View First Team");
    expect(html).toContain("financial strategy is unavailable.");
    expect(html).toContain("Action Player");
  });

  it("renders the empty state after available sources return no actions", () => {
    const html = renderToStaticMarkup(
      <ActionQueuePanel
        financialStatus="ready"
        items={[]}
        onNavigateToView={vi.fn()}
        onSelectPlayer={vi.fn()}
        squadStatus="ready"
      />
    );

    expect(html).toContain("No active actions.");
  });
});

function createActions(count: number): ActionQueueItem[] {
  return Array.from({ length: count }, (_, index) =>
    createAction({
      id: `action-${index + 1}`,
      title: `Action ${index + 1}`,
      horizon: index < 3 ? "current" : "next_season"
    })
  );
}

function createAction(overrides: Partial<ActionQueueItem> = {}): ActionQueueItem {
  return {
    id: "action",
    source: "squad",
    priority: "high",
    horizon: "current",
    confidence: "High",
    title: "Action",
    description: "Action description",
    reasons: ["Action reason"],
    financialImpact: [],
    profile: null,
    players: [],
    destination: { kind: "view", view: "finances" },
    ...overrides
  };
}
