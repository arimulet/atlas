import { describe, expect, it } from "vitest";
import { calculateHistoricalTrends, type SnapshotComparisonSnapshot } from "../src/index.js";

describe("calculateHistoricalTrends", () => {
  it("calculates player and squad trends with evidence", () => {
    const trends = calculateHistoricalTrends([
      snapshot({ id: "s-1", snapshotDate: "2026-08-05" }),
      snapshot({
        id: "s-2",
        snapshotDate: "2026-08-12",
        player: { wage: 15000, estimatedValue: 500000, pace: 11 }
      })
    ]);

    expect(trends.players[0]?.value).toMatchObject({
      direction: "up",
      currency: "ARS",
      isComparable: true,
      evidence: {
        initialSnapshot: { snapshotId: "s-1", snapshotDate: "2026-08-05", value: 450000 },
        finalSnapshot: { snapshotId: "s-2", snapshotDate: "2026-08-12", value: 500000 },
        deltaAbsolute: 50000,
        dataPoints: 2
      }
    });
    expect(trends.players[0]?.wage.evidence.deltaPercentage).toBe(25);
    expect(trends.players[0]?.skills.find((skill) => skill.skill === "pace")).toMatchObject({
      direction: "up",
      evidence: { deltaAbsolute: 1, dataPoints: 2 }
    });
    expect(trends.squad.valueTotal.evidence.deltaAbsolute).toBe(50000);
    expect(trends.squad.wageTotal.evidence.deltaAbsolute).toBe(3000);
    expect(trends.squad.mainVariations).toContainEqual(
      expect.objectContaining({
        playerId: 1001,
        metric: "estimatedValue",
        deltaAbsolute: 50000,
        direction: "up"
      })
    );
  });

  it("returns insufficient_data when only one snapshot exists", () => {
    const trends = calculateHistoricalTrends([snapshot({ id: "s-1" })]);

    expect(trends.warnings).toEqual(["At least two snapshots are required for trends."]);
    expect(trends.players[0]?.value.direction).toBe("insufficient_data");
    expect(trends.players[0]?.value.evidence).toMatchObject({
      deltaAbsolute: null,
      deltaPercentage: null,
      dataPoints: 1
    });
    expect(trends.squad.valueTotal.direction).toBe("insufficient_data");
  });

  it("classifies down and stable trends", () => {
    const trends = calculateHistoricalTrends([
      snapshot({ id: "s-1", player: { wage: 12000, estimatedValue: 450000 } }),
      snapshot({ id: "s-2", player: { wage: 12000, estimatedValue: 430000 } })
    ]);

    expect(trends.players[0]?.value.direction).toBe("down");
    expect(trends.players[0]?.wage.direction).toBe("stable");
  });

  it("does not merge players with ambiguous identities", () => {
    const trends = calculateHistoricalTrends([
      snapshot({ id: "s-1", player: { playerId: null } }),
      snapshot({ id: "s-2", player: { playerId: null, wage: 15000 } })
    ]);

    expect(trends.players).toHaveLength(0);
    expect(trends.squad.warnings).toEqual([
      "Snapshot s-1 player Tomas Alvarez is excluded from player trends: missing-stable-identity.",
      "Snapshot s-2 player Tomas Alvarez is excluded from player trends: missing-stable-identity."
    ]);
  });

  it("does not infer skill trends when comparable skill data is missing", () => {
    const trends = calculateHistoricalTrends([
      snapshot({ id: "s-1", player: { pace: null } }),
      snapshot({ id: "s-2", player: { pace: 11 } })
    ]);
    const pace = trends.players[0]?.skills.find((skill) => skill.skill === "pace");

    expect(pace?.direction).toBe("insufficient_data");
    expect(pace?.evidence.dataPoints).toBe(1);
    expect(pace?.evidence.warnings).toContain("At least two data points are required.");
  });
});

function snapshot(overrides: {
  id?: string;
  clubId?: string;
  snapshotDate?: string;
  player?: {
    externalId?: string | null;
    playerId?: number | null;
    wage?: number;
    estimatedValue?: number;
    pace?: number | null;
  };
} = {}): SnapshotComparisonSnapshot {
  return {
    id: overrides.id ?? "s-1",
    clubId: overrides.clubId ?? "club-1",
    snapshotDate: overrides.snapshotDate ?? "2026-08-05",
    players: [
      {
        id: `${overrides.id ?? "s-1"}-player-1`,
        playerId: overrides.player?.playerId === undefined ? 1001 : overrides.player.playerId,
        name: "Tomas Alvarez",
        age: 24,
        wage: { amount: overrides.player?.wage ?? 12000, currency: "ARS" },
        estimatedValue: { amount: overrides.player?.estimatedValue ?? 450000, currency: "ARS" },
        skills: {
          stamina: 9,
          pace: overrides.player?.pace === undefined ? 10 : overrides.player.pace,
          technique: 8,
          passing: 7,
          keeper: 1,
          defender: 5,
          playmaker: 6,
          striker: 4
        }
      }
    ]
  };
}
