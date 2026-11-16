import { describe, expect, it } from "vitest";
import { calculateGameWeek } from "@atlas/domain";
import { getMilestoneSeasonWeek } from "../milestone-calendar";

describe("getMilestoneSeasonWeek", () => {
  it("uses the supplied season week when present", () => {
    expect(getMilestoneSeasonWeek(4, 3, calculateGameWeek(61, 13))).toBe(4);
  });

  it("recovers a missing week from the snapshot, including season changes", () => {
    const gameWeek = calculateGameWeek(61, 13);

    expect(getMilestoneSeasonWeek(undefined, 4, gameWeek)).toBe(4);
    expect(getMilestoneSeasonWeek(null, 1, gameWeek)).toBe(1);
  });

  it("returns no week when calendar data is unavailable", () => {
    expect(getMilestoneSeasonWeek(undefined, 4, null)).toBeNull();
    expect(getMilestoneSeasonWeek(undefined, 4, 1)).toBeNull();
  });
});
