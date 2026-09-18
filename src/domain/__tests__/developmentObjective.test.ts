import { describe, expect, it } from "vitest";
import {
  PlayerDevelopmentPlanner,
  generatePlayerTrainingPath,
  type DevelopmentPlayer
} from "@atlas/domain";

function player(overrides: Partial<DevelopmentPlayer> = {}): DevelopmentPlayer {
  return {
    playerId: 39811507,
    age: 21,
    skills: {
      pace: 14,
      defender: 15,
      technique: 8,
      passing: 7,
      stamina: 7,
      keeper: 1,
      playmaker: 7,
      striker: 4
    },
    ...overrides
  };
}

describe("Development Objective (Sportive vs Financial)", () => {
  it("keeps the target source as automatic when configuring objective alone", () => {
    const planner = new PlayerDevelopmentPlanner();

    const sportivePlan = planner.createPlan(player(), { objective: "sportive" });
    expect(sportivePlan.target.source).toBe("automatic");
    expect(sportivePlan.target.objective).toBe("sportive");

    const financialPlan = planner.createPlan(player(), { objective: "financial" });
    expect(financialPlan.target.source).toBe("automatic");
    expect(financialPlan.target.objective).toBe("financial");
  });

  it("prioritizes market-gain primary skills when objective is financial", () => {
    const planner = new PlayerDevelopmentPlanner();
    const defenderPlayer = player();

    // Sportive plan prioritizes technique (8 -> 9) to balance profile
    const sportivePlan = planner.createPlan(defenderPlayer, { objective: "sportive" });
    const sportivePath = generatePlayerTrainingPath({
      player: { ...defenderPlayer, age: 21 },
      target: sportivePlan.target
    });
    expect(sportivePath.steps[0]?.skill).toBe("technique");

    // Financial plan prioritizes primary market multipliers (pace / defender)
    const financialPlan = planner.createPlan(defenderPlayer, { objective: "financial" });
    const financialPath = generatePlayerTrainingPath({
      player: { ...defenderPlayer, age: 21 },
      target: financialPlan.target
    });
    expect(["pace", "defender"]).toContain(financialPath.steps[0]?.skill);
  });
});
