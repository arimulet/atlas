import { describe, expect, it } from "vitest";

import { skillLevelLabel } from "./skill-level-label";

describe("skillLevelLabel", () => {
  it("returns the Sokker label for a known level", () => {
    expect(skillLevelLabel(8)).toBe("sólido");
  });

  it("returns null for missing or unsupported levels", () => {
    expect(skillLevelLabel(null)).toBeNull();
    expect(skillLevelLabel(19)).toBeNull();
  });
});
