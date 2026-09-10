import { describe, expect, it } from "vitest";

import { findCountryCode } from "../index";

describe("findCountryCode", () => {
  it("resolves country names from every registered language", () => {
    expect(findCountryCode("Argentina")).toBe("AR");
    expect(findCountryCode("Deutschland")).toBe("DE");
    expect(findCountryCode("Hellas")).toBe("GR");
    expect(findCountryCode("Polska")).toBe("PL");
  });

  it("accepts alpha-2 codes regardless of their casing", () => {
    expect(findCountryCode("de")).toBe("DE");
  });
});
