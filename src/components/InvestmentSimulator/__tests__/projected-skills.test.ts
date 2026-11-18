import { describe, expect, it } from "vitest";
import { buildProjectedSkillSnapshots } from "../projected-skills";

describe("buildProjectedSkillSnapshots", () => {
  it("includes general training gains in the tooltip for this and later milestones", () => {
    const snapshots = buildProjectedSkillSnapshots(
      { pace: 8, defender: 10, stamina: 5 },
      [
        { skill: "defender", level: 11, residualChanges: [{ skill: "stamina", level: 6 }] },
        { skill: "pace", level: 9, residualChanges: [{ skill: "defender", level: 12 }] }
      ]
    );
    expect(snapshots).toEqual([
      { pace: 8, defender: 11, stamina: 6 },
      { pace: 9, defender: 12, stamina: 6 }
    ]);
  });
  it("keeps each milestone's cumulative skills independent and leaves unknown skills absent", () => {
    const initial = { pace: 8, defender: 10, stamina: 6 };
    const steps = [
      { skill: "defender", level: 11 },
      { skill: "pace", level: 9 },
      { skill: "defender", level: 12 }
    ];

    const snapshots = buildProjectedSkillSnapshots(initial, steps);

    expect(snapshots).toEqual([
      { pace: 8, defender: 11, stamina: 6 },
      { pace: 9, defender: 11, stamina: 6 },
      { pace: 9, defender: 12, stamina: 6 }
    ]);
    expect(initial).toEqual({ pace: 8, defender: 10, stamina: 6 });
    expect(snapshots[2]).not.toHaveProperty("keeper");
  });
});
