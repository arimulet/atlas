import { describe, expect, it } from "vitest";
import type { TrainingWeek } from "../../training/types.js";
import { estimateHistoricalSkillProgress } from "../residual-training.js";

function week(overrides: Partial<TrainingWeek>): TrainingWeek {
  return { week: 1, intensity: 100, kind: "advanced", type: "passing", skill: "passing", skillChanges: [], ...overrides } as TrainingWeek;
}

describe("historical residual training", () => {
  it("counts direct and residual training after the last observed skill change", () => {
    const history = { playerId: 1, weeks: [
      week({ week: 1, skillChanges: [{ skill: "defending", before: 9, after: 10, delta: 1, direction: "up" }] }),
      week({ week: 2, type: "defending", skill: "defending" }),
      week({ week: 3 }),
      week({ week: 4, intensity: 0 })
    ] };

    const result = estimateHistoricalSkillProgress({
      history, currentGameWeek: 4, allowKeeperResidual: false, weeklyDirectPoints: () => 100, weeklyReferencePoints: () => 100
    });

    expect(result.defender).toEqual({ accumulatedPoints: 115, hasKnownBaseline: true, hasHistoryGaps: false });
    expect(result.stamina?.accumulatedPoints).toBe(15);
    expect(result.passing?.accumulatedPoints).toBe(215);
  });

  it("flags gaps and leaves the baseline uncertain when no change is observed", () => {
    const result = estimateHistoricalSkillProgress({
      history: { playerId: 1, weeks: [week({ week: 1 }), week({ week: 3 })] },
      currentGameWeek: 3, allowKeeperResidual: false, weeklyDirectPoints: () => 100, weeklyReferencePoints: () => 100
    });

    expect(result.pace).toEqual({ accumulatedPoints: 30, hasKnownBaseline: false, hasHistoryGaps: true });
  });

  it("treats general training as residual for every skill and maps striker changes correctly", () => {
    const result = estimateHistoricalSkillProgress({
      history: { playerId: 1, weeks: [
        week({ week: 1, type: "striker", skill: "scoring", skillChanges: [{ skill: "striker", before: 7, after: 8, delta: 1, direction: "up" }] }),
        week({ week: 2, type: "general", skill: "pace" }),
        week({ week: 3, type: "stamina", skill: "pace" }),
        week({ week: 4, type: "passing", intensity: 0 })
      ] },
      currentGameWeek: 4, allowKeeperResidual: false, weeklyDirectPoints: () => 100, weeklyReferencePoints: () => 100
    });

    expect(result.striker).toEqual({ accumulatedPoints: 30, hasKnownBaseline: true, hasHistoryGaps: false });
    expect(result.pace?.accumulatedPoints).toBe(45);
    expect(result.stamina?.accumulatedPoints).toBe(110);
  });

  it("only estimates keeper residual for GK while preserving observed direct keeper sessions", () => {
    const input = {
      history: { playerId: 1, weeks: [
        week({ week: 1, type: "keeper", skill: "pace" }),
        week({ week: 2, type: "passing" })
      ] },
      currentGameWeek: 2,
      weeklyDirectPoints: () => 100,
      weeklyReferencePoints: () => 100
    };

    const fieldPlayer = estimateHistoricalSkillProgress({ ...input, allowKeeperResidual: false });
    const goalkeeper = estimateHistoricalSkillProgress({ ...input, allowKeeperResidual: true });

    expect(fieldPlayer.keeper?.accumulatedPoints).toBe(100);
    expect(goalkeeper.keeper?.accumulatedPoints).toBe(115);
    expect(fieldPlayer.passing?.accumulatedPoints).toBe(goalkeeper.passing?.accumulatedPoints);
  });
});
