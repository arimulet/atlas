import { describe, expect, it } from "vitest";
import { calculateGameWeek, normalizeSeasonWeek } from "@atlas/application";

describe("Sokker season week normalization", () => {
  it("maps the current calibrated game week to season week 7", () => {
    expect(normalizeSeasonWeek(1204)).toBe(7);
  });

  it("rolls from week 13 into week 1 of the next season", () => {
    expect(normalizeSeasonWeek(1210)).toBe(13);
    expect(normalizeSeasonWeek(1211)).toBe(1);
  });

  it("rejects game weeks before the 13-week season baseline", () => {
    expect(() => normalizeSeasonWeek(976)).toThrow();
  });

  it("calculates an absolute game week from a season week", () => {
    expect(calculateGameWeek(61, 1)).toBe(977);
    expect(calculateGameWeek(78, 7)).toBe(1204);
  });
});
