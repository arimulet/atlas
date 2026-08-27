import { describe, expect, it } from "vitest";

import { playerDevelopmentTargetBodySchema } from "./schemas.js";

describe("playerDevelopmentTargetBodySchema", () => {
  it("accepts only the target levels relevant to the selected profile", () => {
    const result = playerDevelopmentTargetBodySchema.safeParse({
      profile: "defender",
      targetLevels: {
        defender: 15,
        pace: 11,
        passing: 10
      }
    });

    expect(result.success).toBe(true);
  });
});
