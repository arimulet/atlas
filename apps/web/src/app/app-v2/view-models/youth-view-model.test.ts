import { describe, expect, it } from "vitest";

import type { RealYouthAcademyPlanning } from "@atlas/web/app/types";
import { createYouthAttentionItems, createYouthPlayerRows } from "./youth-view-model";

describe("youth view model", () => {
  it("maps observed youth fields without inventing position or progress", () => {
    const planning = createPlanning();

    const rows = createYouthPlayerRows(planning);

    expect(rows[0]).toMatchObject({
      id: "youth-1",
      name: "Ana Silva",
      age: 16,
      position: null,
      level: { value: 8, label: null },
      weeksLeft: 0,
      progress: null,
      promotion: "Ready",
      status: "Promotion"
    });
  });

  it("orders existing youth signals by severity and caps attention at five items", () => {
    const planning = createPlanning();

    const items = createYouthAttentionItems(planning);

    expect(items).toEqual([
      {
        id: "youth-2-youth_stagnation_risk",
        playerName: "Luis Costa",
        message: "Stagnation risk",
        severity: "medium"
      },
      {
        id: "youth-1-youth_ready_for_promotion",
        playerName: "Ana Silva",
        message: "Ready for promotion",
        severity: "info"
      },
      {
        id: "youth-2-missing_skill",
        playerName: "Luis Costa",
        message: "Missing current-level data",
        severity: "info"
      }
    ]);
  });

  it("uses the persisted promotion status instead of inferring it from weeks", () => {
    const planning = createPlanning();
    const academyPlayerPlanning = {
      ...planning,
      derived: {
        ...planning.derived,
        players: [{ ...planning.derived.players[0]!, status: "in_academy" as const }]
      }
    };

    const academyRows = createYouthPlayerRows(academyPlayerPlanning);

    expect(academyRows[0]?.promotion).toBeNull();

    const promotedPlayerPlanning = {
      ...planning,
      derived: {
        ...planning.derived,
        players: [{ ...planning.derived.players[0]!, status: "promoted" as const }]
      }
    };

    const promotedRows = createYouthPlayerRows(promotedPlayerPlanning);

    expect(promotedRows[0]?.promotion).toBe("Promoted");
  });
});

function createPlanning(): RealYouthAcademyPlanning {
  return {
    clubId: "club-1",
    snapshotId: "snapshot-1",
    snapshotDate: "2026-08-14",
    observed: {
      players: [],
      coverage: {
        totalYouthCount: 2,
        youthsWithWeeksRemaining: 2,
        youthsWithSkill: 1
      },
      source: "snapshot.juniors"
    },
    manual: { academyInvestment: "balanced" },
    derived: {
      categoryCounts: {
        standout_prospect: 0,
        ready_for_promotion: 1,
        follow_up: 0,
        stagnation_risk: 1,
        insufficient_data: 0
      },
      players: [
        {
          id: "youth-1",
          externalId: null,
          name: "Ana Silva",
          age: 16,
          weeksRemaining: 0,
          weeksInAcademy: 5,
          projectedPromotionAge: null,
          skill: 8,
          status: "ready_for_promotion",
          category: "ready_for_promotion",
          severity: "info",
          confidence: "high",
          rationale: "Ready",
          signals: [
            {
              code: "youth_ready_for_promotion",
              severity: "info",
              confidence: "high",
              message: "Ready for promotion",
              evidence: []
            }
          ],
          warnings: []
        },
        {
          id: "youth-2",
          externalId: null,
          name: "Luis Costa",
          age: 17,
          weeksRemaining: 4,
          weeksInAcademy: 16,
          projectedPromotionAge: null,
          skill: null,
          status: "in_academy",
          category: "stagnation_risk",
          severity: "medium",
          confidence: "medium",
          rationale: "Review",
          signals: [
            {
              code: "youth_stagnation_risk",
              severity: "medium",
              confidence: "medium",
              message: "Stagnation risk",
              evidence: []
            }
          ],
          warnings: [
            {
              code: "missing_skill",
              message: "The source message is intentionally not rendered verbatim.",
              evidence: []
            }
          ]
        }
      ]
    },
    warnings: []
  };
}
