import { describe, expect, it } from "vitest";

import { createTrainingPlayerRows, trainingStatusForPlayer } from "./training-view-model";

describe("createTrainingPlayerRows", () => {
  it("combines recorded changes with derived changes without treating counters as skills", () => {
    const players = [{
      id: "player-1",
      playerId: 42,
      name: "Player One",
      age: 20,
      training: { position: 1, advanced: true },
      latestReport: {
        playerId: 42,
        gameWeek: 1200,
        seasonWeek: 2,
        date: "2026-01-01",
        type: "pace",
        kind: "advanced" as const,
        intensity: 100,
        age: 20,
        skills: { pace: 12 },
        skillsChange: { pace: 1, defending: -1, passing: 0, up: 1, down: 1 },
        skillChanges: [{ skill: "pace", before: 11, after: 12, delta: 1, direction: "up" as const }]
      }
    }];

    const [row] = createTrainingPlayerRows(players, null);

    expect(row?.skillChanges).toEqual([
      { skill: "pace", delta: 1 },
      { skill: "defending", delta: -1 }
    ]);
  });

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
      expect.objectContaining({ progress: 82, talent: 3.4, nextSkillUp: 14, etaWeeks: 2, value: null, valueChange: null }),
      expect.objectContaining({ talent: null, nextSkillUp: null, etaWeeks: null, value: null, valueChange: null })
    ]);
  });

  it("maps value and valueChange from TrainingPagePlayer", () => {
    const rows = createTrainingPlayerRows(
      [
        {
          id: "player-1",
          playerId: 42,
          name: "Player One",
          age: 18,
          value: 500000,
          valueChange: 25000,
          training: { position: 2, advanced: true }
        }
      ],
      null
    );

    expect(rows[0]).toMatchObject({
      value: 500000,
      valueChange: 25000
    });
  });

  it("uses player.training.advanced for trainingKind and skips unprocessed latestReport", () => {
    const players = [
      {
        id: "player-1",
        playerId: 42,
        name: "Player One",
        age: 20,
        training: { position: 1, advanced: true },
        latestReport: {
          playerId: 42,
          gameWeek: 1201,
          seasonWeek: 3,
          date: "2026-01-08",
          type: "general",
          kind: "formation" as const,
          intensity: 0,
          age: 20,
          skills: { pace: 12 },
          skillsChange: { pace: 0, up: 0, down: 0 },
          skillChanges: []
        }
      },
      {
        id: "player-2",
        playerId: 43,
        name: "Player Two",
        age: 22,
        training: { position: 1, advanced: false },
        latestReport: {
          playerId: 43,
          gameWeek: 1201,
          seasonWeek: 3,
          date: "2026-01-08",
          type: "general",
          kind: "formation" as const,
          intensity: 0,
          age: 22,
          skills: { pace: 10 },
          skillsChange: { pace: 0, up: 0, down: 0 },
          skillChanges: []
        }
      }
    ];

    const history = [
      {
        playerId: 42,
        gameWeek: 1200,
        seasonWeek: 2,
        date: "2026-01-01",
        type: "pace",
        kind: "advanced" as const,
        intensity: 100,
        age: 20,
        skills: { pace: 12 },
        skillsChange: { pace: 1, up: 1, down: 0 },
        skillChanges: [{ skill: "pace", before: 11, after: 12, delta: 1, direction: "up" as const }]
      },
      {
        playerId: 43,
        gameWeek: 1200,
        seasonWeek: 2,
        date: "2026-01-01",
        type: "pace",
        kind: "formation" as const,
        intensity: 99,
        age: 22,
        skills: { pace: 10 },
        skillsChange: { pace: 0, up: 0, down: 0 },
        skillChanges: []
      },
      players[0]!.latestReport,
      players[1]!.latestReport
    ];

    const rows = createTrainingPlayerRows(players, null, undefined, history);

    expect(rows[0]?.trainingKind).toBe("advanced");
    expect(rows[0]?.trainingType).toBe("pace");
    expect(rows[0]?.intensity).toBe(100);
    expect(rows[0]?.skillChanges).toEqual([{ skill: "pace", delta: 1 }]);

    expect(rows[1]?.trainingKind).toBe("formation");
    expect(rows[1]?.trainingType).toBe("pace");
    expect(rows[1]?.intensity).toBe(99);
    expect(rows[1]?.skillChanges).toEqual([]);
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

  it("returns no status when a diagnostic has no findings", () => {
    const player = {
      id: "player-1",
      playerId: 42,
      name: "Player One",
      age: 18,
      training: { position: 2, advanced: true }
    };
    const diagnostic = {} as unknown as { findings: never[] };

    const status = trainingStatusForPlayer(player, diagnostic);

    expect(status).toBeNull();
  });
});
