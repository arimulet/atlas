import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ClubModel, ImportEventModel, PlayerModel, SnapshotModel } from "@atlas/database";
import {
  getClubDashboard,
  importPlayerSnapshot,
  updateClubOperatingSettings
} from "../src/index.js";

let mongo: MongoMemoryServer;

const validSnapshotPath = path.resolve(
  "packages/test-fixtures/fixtures/player-snapshot/valid.json"
);

describe("Club dashboard use case", () => {
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

  it("shows profile, effective settings and snapshot readiness without hiding provenance", async () => {
    const importResult = await importPlayerSnapshot({ payload: readValidSnapshot() });

    await updateClubOperatingSettings({
      clubId: importResult.clubId!,
      manual: {
        currency: "ARS",
        week: 6,
        preferences: {
          "market.strategy": "opportunistic"
        }
      }
    });

    const dashboard = await getClubDashboard({ clubId: importResult.clubId! });

    expect(dashboard.club.observed).toMatchObject({
      name: "River Plate Forever",
      season: 78,
      week: 4
    });
    expect(dashboard.club.manual).toMatchObject({
      currency: "ARS",
      week: 6
    });
    expect(dashboard.settings.effective).toMatchObject({
      currency: "ARS",
      season: 78,
      week: 6,
      preferences: {
        "economy.riskTolerance": "balanced",
        "training.priority": "balanced",
        "academy.investment": "balanced",
        "market.strategy": "opportunistic"
      }
    });
    expect(dashboard.snapshots).toMatchObject({
      available: true,
      count: 1,
      canCompare: false
    });
    expect(dashboard.snapshots.latest).toMatchObject({
      snapshotDate: "2026-08-05",
      season: 78,
      week: 4,
      playerCount: 1
    });
    expect(dashboard.operationalAreas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "diagnostic", status: "available" }),
        expect.objectContaining({ key: "history", status: "ready" }),
        expect.objectContaining({ key: "squad-economy", status: "available" })
      ])
    );
  });

  it("marks historical access available when the club has at least two snapshots", async () => {
    const first = readValidSnapshot();
    const second = {
      ...first,
      source: { ...first.source, exportedAt: "2026-08-12T12:00:00.000Z" },
      snapshot: { ...first.snapshot, snapshotDate: "2026-08-12", week: 5 }
    };

    const importResult = await importPlayerSnapshot({ payload: first });
    await importPlayerSnapshot({ payload: second });

    const dashboard = await getClubDashboard({ clubId: importResult.clubId! });

    expect(dashboard.snapshots.count).toBe(2);
    expect(dashboard.snapshots.canCompare).toBe(true);
    expect(dashboard.snapshots.previous?.snapshotDate).toBe("2026-08-05");
    expect(dashboard.snapshots.latest?.snapshotDate).toBe("2026-08-12");
    expect(dashboard.operationalAreas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "history", status: "available" }),
        expect.objectContaining({ key: "findings", status: "available" })
      ])
    );
  });
});

function readValidSnapshot() {
  return JSON.parse(fs.readFileSync(validSnapshotPath, "utf8")) as {
    source: { exportedAt: string };
    snapshot: { snapshotDate: string; week: number };
  };
}
