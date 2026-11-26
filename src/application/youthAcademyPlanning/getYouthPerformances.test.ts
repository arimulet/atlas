import { describe, expect, it, vi } from "vitest";
import { getYouthPerformances } from "./getYouthPerformances.js";
import type { PersistedJuniorMatch } from "@atlas/database";

describe("getYouthPerformances", () => {
  const mockClubRepo = {
    findById: vi.fn(async (id: string) => ({ id, clubId: 100 }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  it("marks a performance as isImproved when the latest match sets or beats the previous performance", async () => {
    const matches: PersistedJuniorMatch[] = [
      {
        id: "match-1",
        matchId: 1001,
        clubId: 100,
        season: 78,
        gameWeek: 1200,
        seasonWeek: 1,
        dateExpected: new Date("2026-10-01T20:00:00Z"),
        isFinished: true,
        playerStats: [
          {
            playerId: 501,
            position: 1, // DEF
            minutesPlayed: 45, // half match
            rating: 15,
            goals: 0,
            assists: 0,
            shoots: 0,
            fouls: 0,
            yellowCards: 0,
            redCards: 0,
            isInjured: false,
            timeDefending: 200
          }
        ]
      },
      {
        id: "match-2",
        matchId: 1002,
        clubId: 100,
        season: 78,
        gameWeek: 1201,
        seasonWeek: 2,
        dateExpected: new Date("2026-10-08T20:00:00Z"),
        isFinished: true,
        playerStats: [
          {
            playerId: 501,
            position: 1, // DEF
            minutesPlayed: 90, // full match and higher rating -> improvement!
            rating: 22,
            goals: 0,
            assists: 0,
            shoots: 0,
            fouls: 0,
            yellowCards: 0,
            redCards: 0,
            isInjured: false,
            timeDefending: 500
          },
          {
            playerId: 502,
            position: 2, // MID - new first appearance
            minutesPlayed: 45,
            rating: 18,
            goals: 0,
            assists: 0,
            shoots: 0,
            fouls: 0,
            yellowCards: 0,
            redCards: 0,
            isInjured: false,
            timeDefending: 300
          }
        ]
      }
    ];

    const mockMatchesRepo = {
      findByClubId: vi.fn(async () => matches)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const result = await getYouthPerformances("club-100", mockMatchesRepo, mockClubRepo);

    const p501 = result.players["501"];
    expect(p501).toBeDefined();
    expect(p501?.def?.rating).toBe(22);
    expect(p501?.def?.minutes).toBe(90);
    expect(p501?.def?.isImproved).toBe(true);

    const p502 = result.players["502"];
    expect(p502).toBeDefined();
    expect(p502?.mid?.rating).toBe(18);
    expect(p502?.mid?.isImproved).toBe(true);
  });

  it("does not mark as isImproved when the latest match does not beat the existing performance", async () => {
    const matches: PersistedJuniorMatch[] = [
      {
        id: "match-1",
        matchId: 1001,
        clubId: 100,
        season: 78,
        gameWeek: 1200,
        seasonWeek: 1,
        dateExpected: new Date("2026-10-01T20:00:00Z"),
        isFinished: true,
        playerStats: [
          {
            playerId: 501,
            position: 1, // DEF
            minutesPlayed: 90,
            rating: 25,
            goals: 0,
            assists: 0,
            shoots: 0,
            fouls: 0,
            yellowCards: 0,
            redCards: 0,
            isInjured: false,
            timeDefending: 600
          }
        ]
      },
      {
        id: "match-2",
        matchId: 1002,
        clubId: 100,
        season: 78,
        gameWeek: 1201,
        seasonWeek: 2,
        dateExpected: new Date("2026-10-08T20:00:00Z"),
        isFinished: true,
        playerStats: [
          {
            playerId: 501,
            position: 1, // DEF
            minutesPlayed: 90,
            rating: 20, // Worse rating -> does not beat match-1
            goals: 0,
            assists: 0,
            shoots: 0,
            fouls: 0,
            yellowCards: 0,
            redCards: 0,
            isInjured: false,
            timeDefending: 400
          }
        ]
      }
    ];

    const mockMatchesRepo = {
      findByClubId: vi.fn(async () => matches)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const result = await getYouthPerformances("club-100-tied", mockMatchesRepo, mockClubRepo);

    const p501 = result.players["501"];
    expect(p501?.def?.rating).toBe(25);
    expect(p501?.def?.isImproved).toBe(false);
  });

  it("does not mark as isImproved when the latest match ties the existing performance", async () => {
    const matches: PersistedJuniorMatch[] = [
      {
        id: "match-1",
        matchId: 1001,
        clubId: 100,
        season: 78,
        gameWeek: 1200,
        seasonWeek: 1,
        dateExpected: new Date("2026-10-01T20:00:00Z"),
        isFinished: true,
        playerStats: [
          {
            playerId: 501,
            position: 1, // DEF
            minutesPlayed: 90,
            rating: 25,
            goals: 0,
            assists: 0,
            shoots: 0,
            fouls: 0,
            yellowCards: 0,
            redCards: 0,
            isInjured: false,
            timeDefending: 600
          }
        ]
      },
      {
        id: "match-2",
        matchId: 1002,
        clubId: 100,
        season: 78,
        gameWeek: 1201,
        seasonWeek: 2,
        dateExpected: new Date("2026-10-08T20:00:00Z"),
        isFinished: true,
        playerStats: [
          {
            playerId: 501,
            position: 1, // DEF
            minutesPlayed: 90,
            rating: 25, // Tie -> not improved
            goals: 0,
            assists: 0,
            shoots: 0,
            fouls: 0,
            yellowCards: 0,
            redCards: 0,
            isInjured: false,
            timeDefending: 500
          }
        ]
      }
    ];

    const mockMatchesRepo = {
      findByClubId: vi.fn(async () => matches)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const result = await getYouthPerformances("club-100-tie", mockMatchesRepo, mockClubRepo);

    const p501 = result.players["501"];
    expect(p501?.def?.rating).toBe(25);
    expect(p501?.def?.isImproved).toBe(false);
  });
});
