import { describe, expect, it } from "vitest";

import { createTrainingPlayerRows, trainingStatusForPlayer } from "./training-view-model";

describe("createTrainingPlayerRows", () => {
  it("maps the prepared Player Detail projection summary without deriving values", () => {
    const rows = createTrainingPlayerRows(
      [
        {
          id: "player-1",
          playerId: 42,
          name: "Player One",
          age: 18,
          training: { position: 2, advanced: true }
        },
        {
          id: "player-2",
          playerId: 43,
          name: "Player Two",
          age: 19,
          training: { position: 2, advanced: false }
        }
      ],
      null,
      new Map([["42", { playerId: "42", progress: 82, talent: 3.4, nextSkillUp: 14, etaWeeks: 2 }]])
    );

    expect(rows).toEqual([
      expect.objectContaining({ progress: 82, talent: 3.4, nextSkillUp: 14, etaWeeks: 2 }),
      expect.objectContaining({ talent: null, nextSkillUp: null, etaWeeks: null })
    ]);
  });

  it("labels a training-potential finding as a positive training prospect", () => {
    const player = {
      id: "player-1",
      playerId: 42,
      name: "Player One",
      age: 18,
      training: { position: 2, advanced: true }
    };

    const status = trainingStatusForPlayer(player, {
      findings: [
        {
          code: "training-potential.young-role-fit",
          category: "training-potential",
          severity: "low",
          affectedPlayerIds: ["42"],
          evidence: [],
          assumptions: [],
          confidence: "high",
          recommendations: []
        }
      ]
    });

    expect(status).toBe("Training prospect");
  });
});
