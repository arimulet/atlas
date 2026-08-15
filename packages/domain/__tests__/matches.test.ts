import { describe, expect, it } from "vitest";
import {
  calculateMatchPlayerMinutes,
  classifyMatchPlayerRole,
  classifyMatchType,
  normalizeMatchFormation,
  type MatchPlayerParticipationInput
} from "@atlas/domain";

describe("Match domain rules", () => {
  it.each([
    [{ timeIn: 0, timeOut: 0, rating: 60 }, "STARTER", 90],
    [{ timeIn: 0, timeOut: 60, rating: 60 }, "STARTER", 60],
    [{ timeIn: 60, timeOut: 0, rating: 60 }, "SUBSTITUTE_USED", 30],
    [{ timeIn: 20, timeOut: 75, rating: 60 }, "SUBSTITUTE_USED", 55],
    [{ timeIn: 0, timeOut: 0, rating: 0 }, "SUBSTITUTE_UNUSED", 0],
    [{ timeIn: 0, timeOut: 100, rating: 60 }, "STARTER", 90]
  ])("classifies %o and calculates %s with %i minutes", (input, expectedRole, expectedMinutes) => {
    const participation = input as MatchPlayerParticipationInput;

    expect(classifyMatchPlayerRole(participation)).toBe(expectedRole);
    expect(calculateMatchPlayerMinutes(participation)).toBe(expectedMinutes);
  });

  it.each([
    [0, "GK"],
    [1, "DEF"],
    [2, "MID"],
    [3, "ATT"]
  ])("normalizes formation %i to %s", (formation, expected) => {
    expect(normalizeMatchFormation(formation)).toBe(expected);
  });

  it("classifies official, friendly and arcade competitions without UNKNOWN", () => {
    expect(classifyMatchType({ isOfficial: true, name: "League", type: 1 })).toBe("OFFICIAL");
    expect(classifyMatchType({ isOfficial: true, name: "Cup", type: 2 })).toBe("OFFICIAL");
    expect(classifyMatchType({ isOfficial: false, name: "Friendly", type: 4 })).toBe("FRIENDLY");
    expect(classifyMatchType({ isOfficial: false, name: "Arcade", type: 11 })).toBe("NOT_ELIGIBLE");
  });
});
