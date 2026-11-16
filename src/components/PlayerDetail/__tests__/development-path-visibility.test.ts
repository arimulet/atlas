import { describe, expect, it } from "vitest";

import {
  hasHiddenDevelopmentPathSteps,
  INITIAL_VISIBLE_DEVELOPMENT_PATH_STEPS,
  visibleDevelopmentPath
} from "../development-path-visibility";

describe("development path visibility", () => {
  it("shows only the first eight steps until expanded", () => {
    const path = Array.from({ length: 10 }, (_, index) => index + 1);

    expect(visibleDevelopmentPath(path, false)).toEqual(
      path.slice(0, INITIAL_VISIBLE_DEVELOPMENT_PATH_STEPS)
    );
    expect(visibleDevelopmentPath(path, true)).toEqual(path);
  });

  it("only exposes the expansion control when steps are hidden", () => {
    expect(hasHiddenDevelopmentPathSteps(Array(8))).toBe(false);
    expect(hasHiddenDevelopmentPathSteps(Array(9))).toBe(true);
  });
});
