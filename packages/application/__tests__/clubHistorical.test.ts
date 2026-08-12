import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import validSnapshot from "@atlas/test-fixtures/player-snapshot/valid.json" with { type: "json" };
import { ClubModel, ImportEventModel, PlayerModel, SnapshotModel } from "@atlas/database";
import type { PlayerSnapshotV0 } from "@atlas/contracts";
import { calculateClubHistoricalTrends, generateClubHistoricalFindings } from "../src/clubHistorical/index.js";
import { importPlayerSnapshot } from "../src/playerImport/index.js";

let mongo: MongoMemoryServer;

describe("CalculateClubHistoricalTrends", () => {
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

  it("calculates trends from persisted club snapshots", async () => {
    const base = await importPlayerSnapshot({ payload: payload({ snapshotDate: "2026-08-05" }) });
    await importPlayerSnapshot({
      payload: payload({
        snapshotDate: "2026-08-12",
        player: { wage: 15000, value: 500000, pace: 11 }
      })
    });

    const trends = await calculateClubHistoricalTrends(base.clubId!);

    expect(trends.snapshotDates).toEqual(["2026-08-05", "2026-08-12"]);
    expect(trends.players[0]?.wage.evidence.deltaAbsolute).toBe(3000);
    expect(trends.players[0]?.value.direction).toBe("up");
    expect(trends.squad.valueTotal.direction).toBe("up");
  });

  it("returns explicit insufficient_data with a single persisted snapshot", async () => {
    const imported = await importPlayerSnapshot({
      payload: payload({ snapshotDate: "2026-08-05" })
    });

    const trends = await calculateClubHistoricalTrends(imported.clubId!);

    expect(trends.players[0]?.value.direction).toBe("insufficient_data");
    expect(trends.squad.valueTotal.direction).toBe("insufficient_data");
  });
});


describe("GenerateClubHistoricalFindings", () => {
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

  it("generates historical findings from persisted club snapshots", async () => {
    const base = await importPlayerSnapshot({
      payload: payload({ snapshotDate: "2026-08-05", player: { value: 400000 } })
    });
    await importPlayerSnapshot({
      payload: payload({ snapshotDate: "2026-08-12", player: { value: 450000 } })
    });
    await importPlayerSnapshot({
      payload: payload({
        snapshotDate: "2026-08-19",
        player: { value: 500000, pace: 11 }
      })
    });

    const findings = await generateClubHistoricalFindings(base.clubId!);

    expect(findings.snapshotDates).toEqual(["2026-08-05", "2026-08-12", "2026-08-19"]);
    expect(findings.taxonomy).toContain("player_sustained_asset_appreciation");
    expect(findings.findings).toContainEqual(
      expect.objectContaining({
        type: "player_sustained_asset_appreciation",
        confidence: "high"
      })
    );
  });
});

function payload(overrides: {
  snapshotDate: string;
  player?: {
    wage?: number;
    value?: number;
    pace?: number;
  };
}): PlayerSnapshotV0 {
  const cloned = structuredClone(validSnapshot) as PlayerSnapshotV0;
  cloned.snapshot.snapshotDate = overrides.snapshotDate;
  cloned.source.exportedAt = `${overrides.snapshotDate}T20:00:00.000Z`;

  const player = cloned.players[0]!;
  player.wage = overrides.player?.wage ?? player.wage;
  player.value = overrides.player?.value ?? player.value;
  player.skills.pace = overrides.player?.pace ?? player.skills.pace;

  return cloned;
}