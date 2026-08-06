import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import validSnapshot from "@atlas/test-fixtures/player-snapshot/valid.json" with { type: "json" };
import { ClubModel, ImportEventModel, PlayerModel, SnapshotModel } from "@atlas/database";
import type { PlayerSnapshotV0 } from "@atlas/contracts";
import { compareClubSnapshots, importPlayerSnapshot, listClubSnapshots } from "../src/index.js";

let mongo: MongoMemoryServer;

describe("CompareClubSnapshots", () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  beforeEach(async () => {
    await Promise.all([
      ClubModel.deleteMany({}),
      ImportEventModel.deleteMany({}),
      PlayerModel.deleteMany({}),
      SnapshotModel.deleteMany({})
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it("compares two snapshots resolved by club and date", async () => {
    const base = await importPlayerSnapshot({ payload: payload({ snapshotDate: "2026-08-05" }) });
    const target = await importPlayerSnapshot({
      payload: payload({
        snapshotDate: "2026-08-12",
        player: { wage: 15000, estimatedValue: 500000, pace: 11 }
      })
    });

    const comparison = await compareClubSnapshots({
      clubId: base.clubId!,
      baseSnapshotDate: "2026-08-05",
      targetSnapshotDate: "2026-08-12"
    });
    const snapshots = await listClubSnapshots(base.clubId!);

    expect(target.clubId).toBe(base.clubId);
    expect(snapshots.map((snapshot) => snapshot.snapshotDate)).toEqual([
      "2026-08-05",
      "2026-08-12"
    ]);
    expect(comparison.baseSnapshotId).toBe(base.snapshotId);
    expect(comparison.targetSnapshotId).toBe(target.snapshotId);
    expect(comparison.matchedPlayers[0]?.changes.wage?.delta).toBe(3000);
    expect(comparison.matchedPlayers[0]?.changes.estimatedValue?.delta).toBe(50000);
    expect(comparison.matchedPlayers[0]?.changes.skills).toContainEqual({
      skill: "pace",
      before: 10,
      after: 11,
      delta: 1
    });
  });

  it("requires snapshot id when a club has more than one snapshot for the same date", async () => {
    const first = await importPlayerSnapshot({ payload: payload({ snapshotDate: "2026-08-05" }) });
    await importPlayerSnapshot({ payload: payload({ snapshotDate: "2026-08-05" }) });
    const target = await importPlayerSnapshot({ payload: payload({ snapshotDate: "2026-08-12" }) });

    await expect(
      compareClubSnapshots({
        clubId: first.clubId!,
        baseSnapshotDate: "2026-08-05",
        targetSnapshotId: target.snapshotId!
      })
    ).rejects.toThrow("base snapshot date 2026-08-05 is ambiguous; use snapshot id.");
  });
});

function payload(overrides: {
  snapshotDate: string;
  player?: {
    wage?: number;
    estimatedValue?: number;
    pace?: number;
  };
}): PlayerSnapshotV0 {
  const cloned = structuredClone(validSnapshot) as PlayerSnapshotV0;
  cloned.snapshot.snapshotDate = overrides.snapshotDate;
  cloned.source.exportedAt = `${overrides.snapshotDate}T20:00:00.000Z`;

  const player = cloned.players[0]!;
  player.wage.amount = overrides.player?.wage ?? player.wage.amount;
  player.estimatedValue.amount = overrides.player?.estimatedValue ?? player.estimatedValue.amount;
  player.skills.pace = overrides.player?.pace ?? player.skills.pace;

  return cloned;
}
