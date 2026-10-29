import { describe, expect, it } from "vitest";
import type { FinancialRecommendationViewModel } from "@/app/features/financialStrategy/financial-strategy-view-model";
import type { SquadPlanningBundle } from "@/app/types";
import {
  createActionQueueItems,
  groupActionQueueItems,
  visibleActionQueueItems
} from "./action-queue-view-model";

describe("createActionQueueItems", () => {
  it("combines actionable recommendations and orders them by priority and horizon", () => {
    const items = createActionQueueItems({
      squadPlanning: createSquadPlanning([
        createSquadRecommendation({
          id: "squad-medium",
          priority: "medium",
          horizon: "next_season",
          type: "find_external"
        }),
        createSquadRecommendation({
          id: "squad-high",
          priority: "high",
          horizon: "medium_term",
          type: "prepare_successor"
        })
      ]),
      financialRecommendations: [
        createFinancialRecommendation({
          id: "finance-critical",
          priorityRaw: "critical",
          horizonRaw: "current",
          title: "Preserve cash"
        })
      ]
    });

    expect(items.map((item) => item.id)).toEqual([
      "finance-finance-critical",
      "squad-squad-high",
      "squad-squad-medium"
    ]);
  });

  it("omits monitoring and maintain recommendations from both sources", () => {
    const items = createActionQueueItems({
      squadPlanning: createSquadPlanning([
        createSquadRecommendation({ id: "maintain", type: "maintain" }),
        createSquadRecommendation({ id: "monitor", type: "monitor" })
      ]),
      financialRecommendations: [
        createFinancialRecommendation({ id: "financial-maintain", type: "maintain_position" }),
        createFinancialRecommendation({ id: "financial-monitor", type: "monitor" })
      ]
    });

    expect(items).toEqual([]);
  });

  it("preserves action context and routes player and module destinations", () => {
    const [squadItem, financialItem] = createActionQueueItems({
      squadPlanning: createSquadPlanning([
        createSquadRecommendation({
          id: "squad-player",
          targetPlayerId: 22,
          playerIds: [11, 22],
          reasons: [{ type: "internal_candidate_available", playerId: 22 }]
        })
      ]),
      financialRecommendations: [
        createFinancialRecommendation({
          id: "finance-module",
          profile: "Forward",
          financialImpact: ["Estimated commitment: $100,000"],
          reasons: ["Investment capacity is available"]
        })
      ]
    });

    expect(squadItem).toMatchObject({
      source: "squad",
      players: [
        { id: "11", name: "Current Player" },
        { id: "22", name: "Target Player", countryName: "Argentina" }
      ],
      reasons: ["Target Player is the strongest internal candidate."],
      destination: { kind: "player", playerId: "22" }
    });
    expect(financialItem).toMatchObject({
      source: "finance",
      profile: "Forward",
      financialImpact: ["Estimated commitment: $100,000"],
      reasons: ["Investment capacity is available"],
      destination: { kind: "view", view: "finances" }
    });
  });
});

describe("action queue visibility", () => {
  it("limits the compact queue to five actions and groups visible actions by horizon", () => {
    const items = createActionQueueItems({
      squadPlanning: createSquadPlanning(
        Array.from({ length: 6 }, (_, index) =>
          createSquadRecommendation({
            id: `action-${index}`,
            priority: "high",
            horizon: index < 3 ? "current" : "next_season"
          })
        )
      ),
      financialRecommendations: []
    });

    const compactItems = visibleActionQueueItems(items, false);

    expect(compactItems).toHaveLength(5);
    expect(visibleActionQueueItems(items, true)).toHaveLength(6);
    expect(
      groupActionQueueItems(compactItems).map((group) => [group.horizon, group.items.length])
    ).toEqual([
      ["current", 3],
      ["next_season", 2]
    ]);
  });
});

function createSquadPlanning(recommendations: unknown[]): SquadPlanningBundle {
  return {
    assessment: {
      depthPlayers: [
        { playerId: 11, playerName: "Current Player", countryName: "Chile" },
        { playerId: 22, playerName: "Target Player", countryName: "Argentina" }
      ]
    },
    recommendations: { recommendations }
  } as unknown as SquadPlanningBundle;
}

function createSquadRecommendation(overrides: Record<string, unknown> = {}) {
  return {
    id: "squad-action",
    type: "develop_internal",
    profile: "forward",
    priority: "high",
    horizon: "current",
    playerIds: [],
    confidence: "high",
    reasons: [],
    ...overrides
  };
}

function createFinancialRecommendation(
  overrides: Partial<FinancialRecommendationViewModel> = {}
): FinancialRecommendationViewModel {
  return {
    id: "finance-action",
    type: "invest_in_squad",
    title: "Invest in squad",
    description: "Available capacity can support an identified sporting need.",
    priority: "High",
    priorityRaw: "high",
    horizon: "Current",
    horizonRaw: "current",
    confidence: "High",
    playerIds: [],
    playerNames: [],
    profile: null,
    financialImpact: [],
    reasons: [],
    risks: [],
    ...overrides
  };
}
