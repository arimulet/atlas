import { describe, expect, it } from "vitest";

import { skillLevelLabel, skillLevelLabelEn, formatSokkerSkill } from "./skill-level-label";

describe("skillLevelLabel", () => {
  it("returns the Sokker label for a known level", () => {
    expect(skillLevelLabel(8)).toBe("sólido");
  });

  it("returns the English Sokker label when requested", () => {
    expect(skillLevelLabelEn(8)).toBe("solid");
    expect(skillLevelLabel(8, "en")).toBe("solid");
    expect(skillLevelLabelEn(12)).toBe("outstanding");
    expect(skillLevelLabelEn(0)).toBe("tragic");
  });

  it("returns null for missing or unsupported levels", () => {
    expect(skillLevelLabel(null)).toBeNull();
    expect(skillLevelLabel(19)).toBeNull();
    expect(skillLevelLabelEn(null)).toBeNull();
  });

  it("formats skills in Sokker format", () => {
    expect(formatSokkerSkill(8)).toBe("solid [8]");
    expect(formatSokkerSkill(0)).toBe("tragic [0]");
    expect(formatSokkerSkill(8, "es")).toBe("sólido [8]");
    expect(formatSokkerSkill(null)).toBe("—");
  });
});
