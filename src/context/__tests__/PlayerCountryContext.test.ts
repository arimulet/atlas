import { describe, expect, it } from "vitest";
import {
  registerPlayerCountry,
  registerPlayerCountries,
  getCachedPlayerCountry
} from "../PlayerCountryContext";

describe("PlayerCountryContext cache", () => {
  it("registers and retrieves a single player country", () => {
    registerPlayerCountry("12345", "Argentina");
    expect(getCachedPlayerCountry("12345")).toBe("Argentina");
    expect(getCachedPlayerCountry(12345)).toBe("Argentina");
  });

  it("handles null or undefined gracefully", () => {
    expect(getCachedPlayerCountry(null)).toBeNull();
    expect(getCachedPlayerCountry(undefined)).toBeNull();
    expect(getCachedPlayerCountry("nonexistent")).toBeNull();
  });

  it("registers multiple players in batch", () => {
    registerPlayerCountries([
      { playerId: 9001, countryName: "Poland" },
      { id: "9002", countryName: "Germany" },
      { playerId: 9003, countryName: null }
    ]);

    expect(getCachedPlayerCountry("9001")).toBe("Poland");
    expect(getCachedPlayerCountry("9002")).toBe("Germany");
    expect(getCachedPlayerCountry("9003")).toBeNull();
  });
});
