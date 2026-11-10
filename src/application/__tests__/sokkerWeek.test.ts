import { describe, expect, it } from "vitest";
import { calculateGameWeek, getSokkerSeason, normalizeSeasonWeek } from "@atlas/domain";

describe("Sokker season week normalization", () => {
  it("maps the Sokker-reported game week to its season and week", () => {
    expect(getSokkerSeason(1216)).toBe(79);
    expect(normalizeSeasonWeek(1216)).toBe(7);
  });

  it("rolls from week 13 into week 1 of the next season", () => {
    expect(normalizeSeasonWeek(1209)).toBe(13);
    expect(normalizeSeasonWeek(1210)).toBe(1);
  });

  it("rejects game weeks before the 13-week season baseline", () => {
    expect(() => normalizeSeasonWeek(975)).toThrow();
  });

  it("calculates an absolute game week from a season week", () => {
    expect(calculateGameWeek(61, 1)).toBe(976);
    expect(calculateGameWeek(78, 7)).toBe(1203);
    expect(calculateGameWeek(79, 7)).toBe(1216);
  });
});
