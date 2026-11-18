import { describe, expect, it } from "vitest";
import { buildAcquisitionDevelopmentPlan, projectAcquisitionSkills } from "../acquisition-development.js";
import { calculateGameWeek, getSokkerSeason, normalizeSeasonWeek } from "../../sokker/calendar.js";

describe("buildAcquisitionDevelopmentPlan", () => {
  it("advances age with season transitions for the investment simulator example", () => {
    const currentGameWeek = calculateGameWeek(61, 9);
    const plan = buildAcquisitionDevelopmentPlan({
      playerId: 1,
      age: 18,
      profile: "defender",
      skills: {
        stamina: 5,
        pace: 10,
        technique: 7,
        passing: 8,
        keeper: 0,
        defender: 9,
        playmaker: 8,
        striker: 6
      },
      trainingSkill: "defender",
      hasAdvancedSlot: true,
      talentScenario: "normal",
      currentGameWeek
    });

    expect(plan?.steps.length).toBeGreaterThan(5);
    for (const step of plan?.steps ?? []) {
      expect(step.age).toBe(
        18 + getSokkerSeason(currentGameWeek + step.week) - getSokkerSeason(currentGameWeek)
      );
      expect(step.seasonWeek).toBe(normalizeSeasonWeek(currentGameWeek + step.week));
    }
    const firstNewSeason = plan?.steps.find((step) => step.season === 62);
    expect(firstNewSeason?.age).toBe(19);
    expect(plan?.steps.some((step) => step.season === 61 && step.age === 18)).toBe(true);
    if (plan?.coreWeek != null && plan.coreWeek > 0) {
      expect(plan.coreAge).toBe(18 + getSokkerSeason(currentGameWeek + plan.coreWeek) - getSokkerSeason(currentGameWeek));
    }
  });

  it("recalculates a lower supporting target without reducing primary goals or training stamina", () => {
    const input = {
      playerId: 1,
      age: 18,
      profile: "forward" as const,
      skills: { stamina: 8, pace: 9, technique: 9, passing: 4, striker: 9 },
      trainingSkill: "striker",
      hasAdvancedSlot: true
    };

    const original = buildAcquisitionDevelopmentPlan(input);
    const adjusted = buildAcquisitionDevelopmentPlan({ ...input, targetLevels: { passing: 6 } });

    expect(original?.gaps.find((item) => item.skill === "passing")?.target).toBe(13);
    expect(adjusted?.gaps.find((item) => item.skill === "passing")?.target).toBe(6);
    expect(adjusted?.gaps.find((item) => item.skill === "striker")?.target).toBe(17);
    expect(adjusted?.steps[0]?.skill).not.toBe("passing");
    expect(adjusted?.steps.some((step) => step.skill === "passing" && step.level > 6)).toBe(false);
    expect(adjusted?.steps.flatMap((step) => step.residualChanges).some((change) => change.skill === "passing" && change.level >= 6)).toBe(true);
    expect(adjusted?.steps.some((step) => step.skill === "stamina")).toBe(false);
    expect(adjusted?.steps.at(-1)?.week).toBeLessThan(original?.steps.at(-1)?.week ?? 0);
  });

  it("maps milestones from the club snapshot across season boundaries", () => {
    const currentGameWeek = calculateGameWeek(61, 13);
    const input = {
      playerId: 1,
      age: 19,
      profile: "defender" as const,
      skills: { defender: 15, pace: 15, technique: 13, passing: 13, stamina: 11 },
      trainingSkill: "defender",
      hasAdvancedSlot: true
    };

    const plan = buildAcquisitionDevelopmentPlan({ ...input, currentGameWeek });
    const withoutCalendar = buildAcquisitionDevelopmentPlan(input);

    const first = plan?.steps[0];
    expect(first).toBeDefined();
    expect(first?.season).toBe(getSokkerSeason(currentGameWeek + first!.week));
    expect(first?.seasonWeek).toBe(normalizeSeasonWeek(currentGameWeek + first!.week));
    expect(withoutCalendar?.steps[0]?.seasonWeek).toBeNull();
    expect(withoutCalendar?.steps[0]?.age).toBe(
      19 + Math.floor(withoutCalendar!.steps[0]!.week / 13)
    );
  });

  it("projects faster improvement for high talent and slower improvement for low talent", () => {
    const input = {
      playerId: 1,
      age: 20,
      profile: "defender" as const,
      skills: { defender: 12, pace: 12, technique: 10, passing: 10, stamina: 11 },
      trainingSkill: "defender",
      hasAdvancedSlot: true
    };

    const high = buildAcquisitionDevelopmentPlan({ ...input, talentScenario: "high" });
    const normal = buildAcquisitionDevelopmentPlan({ ...input, talentScenario: "normal" });
    const low = buildAcquisitionDevelopmentPlan({ ...input, talentScenario: "low" });

    expect(high?.steps.at(-1)?.week).toBeLessThan(normal?.steps.at(-1)?.week ?? 0);
    expect(normal?.steps.at(-1)?.week).toBeLessThan(low?.steps.at(-1)?.week ?? 0);
    expect(high?.currentTrainingSteps.at(-1)?.week).toBeLessThan(
      low?.currentTrainingSteps.at(-1)?.week ?? 0
    );
  });

  it("identifies an existing Core player without further training", () => {
    const plan = buildAcquisitionDevelopmentPlan({
      playerId: 1,
      age: 25,
      profile: "defender",
      skills: { defender: 17, pace: 17, technique: 14, passing: 13, stamina: 11 },
      trainingSkill: "defender",
      hasAdvancedSlot: true
    });

    expect(plan?.currentRole).toBe("core");
    expect(plan?.coreWeek).toBe(0);
  });

  it("requires all profile skills rather than inventing missing values", () => {
    const plan = buildAcquisitionDevelopmentPlan({
      playerId: 1,
      age: 19,
      profile: "defender",
      skills: { defender: 14 },
      trainingSkill: null,
      hasAdvancedSlot: true
    });

    expect(plan).toBeNull();
  });

  it("does not assume progress under an unconfigured training focus", () => {
    const plan = buildAcquisitionDevelopmentPlan({
      playerId: 1,
      age: 19,
      profile: "defender",
      skills: { defender: 15, pace: 15, technique: 13, passing: 13, stamina: 10 },
      trainingSkill: null,
      hasAdvancedSlot: true
    });

    expect(plan?.currentTrainingSteps).toEqual([]);
    expect(plan?.gaps.find((gap) => gap.skill === "defender")?.target).toBe(17);
    expect(plan?.steps.length).toBeGreaterThan(0);
  });

  it("assumes sufficient stamina for projected Core without changing actual skills or training steps", () => {
    const input = {
      playerId: 1,
      age: 19,
      profile: "defender" as const,
      skills: { defender: 15, pace: 15, technique: 13, passing: 13, stamina: 3 },
      trainingSkill: "defender",
      hasAdvancedSlot: true
    };

    const plan = buildAcquisitionDevelopmentPlan(input);
    const reference = buildAcquisitionDevelopmentPlan({
      ...input,
      skills: { ...input.skills, stamina: 11 }
    });

    expect(plan?.gaps.find((gap) => gap.skill === "stamina")).toEqual({
      skill: "stamina",
      priority: "supporting",
      current: 3,
      target: 11
    });
    expect(plan?.steps.length).toBeGreaterThan(0);
    expect(plan?.steps.every((step) => step.skill !== "stamina")).toBe(true);
    expect(plan?.coreWeek).toBeGreaterThan(0);
    expect(plan?.coreWeek).toBe(reference?.coreWeek);
    expect(plan?.assumptions).toContain("stamina meets its requirement");
    expect(input.skills.stamina).toBe(3);
  });

  it("applies general training before a direct milestone at the requested horizon", () => {
    const steps = [{
      skill: "defender" as const, level: 10, week: 8,
      residualChanges: [{ skill: "pace" as const, level: 9, week: 4 }]
    }];
    expect(projectAcquisitionSkills({ defender: 9, pace: 8 }, steps, 3)).toEqual({ defender: 9, pace: 8 });
    expect(projectAcquisitionSkills({ defender: 9, pace: 8 }, steps, 4)).toEqual({ defender: 9, pace: 9 });
    expect(projectAcquisitionSkills({ defender: 9, pace: 8 }, steps, 8)).toEqual({ defender: 10, pace: 9 });
  });

  it("keeps the actual role separate when other Core skills are ready but stamina is low", () => {
    const plan = buildAcquisitionDevelopmentPlan({
      playerId: 1,
      age: 25,
      profile: "defender",
      skills: { defender: 17, pace: 17, technique: 14, passing: 13, stamina: 3 },
      trainingSkill: "defender",
      hasAdvancedSlot: true
    });

    expect(plan?.currentRole).not.toBe("core");
    expect(plan?.coreWeek).toBe(0);
  });
});
