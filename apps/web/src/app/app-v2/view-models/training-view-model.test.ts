import { describe, expect, it } from "vitest";

import { createTrainingPlayerRows } from "./training-view-model";

describe("createTrainingPlayerRows", () => {
  it("maps the prepared Player Detail projection summary without deriving values", () => {
    const rows = createTrainingPlayerRows(
      [
        {
          id: "player-1",
          name: "Player One",
          age: 18,
          training: { position: 2, advanced: true }
        },
        {
          id: "player-2",
          name: "Player Two",
          age: 19,
          training: { position: 2, advanced: false }
        }
      ],
      null,
      new Map([["player-1", { playerId: "player-1", talent: 3.4, nextSkillUp: 14, etaWeeks: 2 }]])
    );

    expect(rows).toEqual([
      expect.objectContaining({ talent: 3.4, nextSkillUp: 14, etaWeeks: 2 }),
      expect.objectContaining({ talent: null, nextSkillUp: null, etaWeeks: null })
    ]);
  });
});
