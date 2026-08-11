import { describe, expect, it } from "vitest";
import { compareSnapshots, type SnapshotComparisonSnapshot } from "../src/index.js";

describe("compareSnapshots", () => {
  it("matches the same players by stable identity", () => {
    const comparison = compareSnapshots(
      snapshot({
        players: [player({ playerId: 1, name: "Tomas Alvarez" })]
      }),
      snapshot({
        id: "target",
        snapshotDate: "2026-08-12",
        players: [player({ id: "target-player-1", playerId: 1, name: "Tomas Alvarez" })]
      })
    );

    expect(comparison.matchedPlayers).toHaveLength(1);
    expect(comparison.newPlayers).toHaveLength(0);
    expect(comparison.absentPlayers).toHaveLength(0);
    expect(comparison.ambiguousPlayers).toHaveLength(0);
  });

  it("detects a new player in the target snapshot", () => {
    const comparison = compareSnapshots(
      snapshot({
        players: [player({ playerId: 1, name: "Tomas Alvarez" })]
      }),
      snapshot({
        id: "target",
        players: [
          player({ playerId: 1, name: "Tomas Alvarez" }),
          player({ id: "target-player-2", playerId: 2, name: "Lucas Rios" })
        ]
      })
    );

    expect(comparison.newPlayers.map((newPlayer) => newPlayer.playerId)).toEqual([2]);
    expect(comparison.summary.additionsCount).toBe(1);
    expect(comparison.summary.playerCountBefore).toBe(1);
    expect(comparison.summary.playerCountAfter).toBe(2);
  });

  it("detects an absent player from the base snapshot", () => {
    const comparison = compareSnapshots(
      snapshot({
        players: [
          player({ playerId: 1, name: "Tomas Alvarez" }),
          player({ id: "base-player-2", playerId: 2, name: "Lucas Rios" })
        ]
      }),
      snapshot({
        id: "target",
        players: [player({ playerId: 1, name: "Tomas Alvarez" })]
      })
    );

    expect(comparison.absentPlayers.map((absentPlayer) => absentPlayer.playerId)).toEqual([2]);
    expect(comparison.summary.departuresCount).toBe(1);
  });

  it("does not merge a player without stable identity", () => {
    const comparison = compareSnapshots(
      snapshot({
        players: [player({ playerId: null, name: "Tomas Alvarez" })]
      }),
      snapshot({
        id: "target",
        players: [player({ id: "target-player-1", playerId: null, name: "Tomas Alvarez" })]
      })
    );

    expect(comparison.matchedPlayers).toHaveLength(0);
    expect(comparison.ambiguousPlayers).toMatchObject([
      { snapshot: "base", reason: "missing-stable-identity" },
      { snapshot: "target", reason: "missing-stable-identity" }
    ]);
    expect(comparison.summary.ambiguousPlayersCount).toBe(2);
  });

  it("keeps duplicate stable identities ambiguous", () => {
    const comparison = compareSnapshots(
      snapshot({
        players: [
          player({ playerId: 1, name: "Tomas Alvarez" }),
          player({ id: "base-player-2", playerId: 1, name: "T. Alvarez" })
        ]
      }),
      snapshot({
        id: "target",
        players: [player({ playerId: 1, name: "Tomas Alvarez" })]
      })
    );

    expect(comparison.matchedPlayers).toHaveLength(0);
    expect(comparison.newPlayers.map((newPlayer) => newPlayer.playerId)).toEqual([1]);
    expect(comparison.ambiguousPlayers).toHaveLength(2);
    expect(comparison.ambiguousPlayers.map((entry) => entry.reason)).toEqual([
      "duplicate-stable-identity",
      "duplicate-stable-identity"
    ]);
  });

  it("reports salary, value and skill changes with aggregate squad deltas", () => {
    const comparison = compareSnapshots(
      snapshot({
        players: [
          player({
            playerId: 1,
            age: 22,
            wage: 12000,
            estimatedValue: 450000,
            skills: { pace: 10, passing: 8 }
          }),
          player({ id: "base-player-2", playerId: 2, wage: 8000, estimatedValue: 100000 })
        ]
      }),
      snapshot({
        id: "target",
        players: [
          player({
            id: "target-player-1",
            playerId: 1,
            age: 23,
            wage: 15000,
            estimatedValue: 500000,
            skills: { pace: 11, passing: 8, technique: 10 }
          }),
          player({
            id: "target-player-3",
            playerId: 3,
            wage: 9000,
            estimatedValue: 150000
          })
        ]
      })
    );

    expect(comparison.matchedPlayers[0]?.changes).toMatchObject({
      age: { before: 22, after: 23, delta: 1 },
      wage: { before: 12000, after: 15000, delta: 3000, currency: "ARS", isComparable: true },
      estimatedValue: {
        before: 450000,
        after: 500000,
        delta: 50000,
        currency: "ARS",
        isComparable: true
      }
    });
    expect(comparison.matchedPlayers[0]?.changes.skills).toEqual([
      { skill: "pace", before: 10, after: 11, delta: 1 },
      { skill: "technique", before: 9, after: 10, delta: 1 }
    ]);
    expect(comparison.summary).toMatchObject({
      totalEstimatedValueBefore: 550000,
      totalEstimatedValueAfter: 650000,
      totalEstimatedValueDelta: 100000,
      totalWageBefore: 20000,
      totalWageAfter: 24000,
      totalWageDelta: 4000,
      additionsCount: 1,
      departuresCount: 1
    });
  });

  it("rejects snapshots from different clubs", () => {
    expect(() =>
      compareSnapshots(snapshot({ clubId: "club-a" }), snapshot({ clubId: "club-b" }))
    ).toThrow("Snapshots must belong to the same club.");
  });
});

function snapshot(overrides: Partial<SnapshotComparisonSnapshot> = {}): SnapshotComparisonSnapshot {
  return {
    id: overrides.id ?? "base",
    clubId: overrides.clubId ?? "club-1",
    snapshotDate: overrides.snapshotDate ?? "2026-08-05",
    players: overrides.players ?? [],
    ...overrides
  };
}

function player(overrides: {
  id?: string;
  playerId?: number | null;
  name?: string;
  age?: number;
  wage?: number;
  estimatedValue?: number;
  skills?: Partial<SnapshotComparisonSnapshot["players"][number]["skills"]>;
}): SnapshotComparisonSnapshot["players"][number] {
  return {
    id: overrides.id ?? "snapshot-player-1",
    playerId: overrides.playerId === undefined ? 1 : overrides.playerId,
    name: overrides.name ?? "Tomas Alvarez",
    age: overrides.age ?? 22,
    wage: { amount: overrides.wage ?? 12000, currency: "ARS" },
    estimatedValue: { amount: overrides.estimatedValue ?? 450000, currency: "ARS" },
    skills: {
      stamina: 8,
      pace: 10,
      technique: 9,
      passing: 8,
      keeper: 1,
      defender: 5,
      playmaker: 9,
      striker: 4,
      ...overrides.skills
    }
  };
}
