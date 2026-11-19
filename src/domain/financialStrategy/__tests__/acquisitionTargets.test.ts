import { describe, expect, it } from "vitest";
import { ACQUISITION_POSITION_PROFILES, buildAcquisitionTargetGaps } from "../acquisition-targets.js";

describe("acquisition target defaults", () => {
  const skills = { stamina: 8, pace: 9, technique: 9, passing: 6, keeper: 1, defender: 4, playmaker: 10, striker: 9 };

  it.each([
    ["GK", "keeper"], ["DEF", "defender"], ["MID", "playmaker"], ["ATT", "striker"]
  ] as const)("uses the %s primary skill", (position, primary) => {
    const gaps = buildAcquisitionTargetGaps(ACQUISITION_POSITION_PROFILES[position], skills);
    expect(gaps?.find((gap) => gap.skill === primary)?.priority).toBe("primary");
    expect(gaps?.find((gap) => gap.skill === "stamina")?.target).toBe(11);
  });

  it("builds new defaults independently of edited targets and rejects missing skills", () => {
    const edited = buildAcquisitionTargetGaps("forward", skills, { passing: 8 });
    const defaults = buildAcquisitionTargetGaps("forward", skills);
    expect(edited?.find((gap) => gap.skill === "passing")?.target).toBe(8);
    expect(defaults?.find((gap) => gap.skill === "passing")?.target).toBe(13);
    expect(buildAcquisitionTargetGaps("goalkeeper", { ...skills, keeper: undefined } as unknown as Record<string, number>)).toBeNull();
  });

  it("rejects stamina above its maximum when building targets directly", () => {
    expect(buildAcquisitionTargetGaps("forward", { ...skills, stamina: 11 })).not.toBeNull();
    expect(buildAcquisitionTargetGaps("forward", { ...skills, stamina: 12 })).toBeNull();
  });
});
