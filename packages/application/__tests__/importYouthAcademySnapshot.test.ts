import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import validSnapshot from "@atlas/test-fixtures/youth-academy-snapshot/valid.json" with {
  type: "json"
};
import invalidSnapshot from "@atlas/test-fixtures/youth-academy-snapshot/invalid.json" with {
  type: "json"
};
import acceptedWithWarningsSnapshot from "@atlas/test-fixtures/youth-academy-snapshot/accepted-with-warnings.json" with {
  type: "json"
};
import missingExternalIdSnapshot from "@atlas/test-fixtures/youth-academy-snapshot/missing-external-id.json" with {
  type: "json"
};
import { ClubModel, ImportEventModel, YouthSnapshotModel } from "@atlas/database";
import type { YouthAcademySnapshotV0 } from "@atlas/contracts";
import {
  importYouthAcademySnapshot,
  validateYouthAcademySnapshotImport
} from "../src/index.js";

let mongo: MongoMemoryServer;

describe("ImportYouthAcademySnapshot", () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  beforeEach(async () => {
    await Promise.all([
      ClubModel.deleteMany({}),
      ImportEventModel.deleteMany({}),
      YouthSnapshotModel.deleteMany({})
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it("imports valid youth academy JSON", async () => {
    const result = await importYouthAcademySnapshot({ payload: validSnapshot });

    expect(result.status).toBe("accepted");
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.snapshotId).toEqual(expect.any(String));
    expect(result.clubId).toEqual(expect.any(String));
    expect(result.importedPlayerCount).toBe(1);

    const snapshot = await YouthSnapshotModel.findById(result.snapshotId).lean();
    const club = await ClubModel.findById(result.clubId).lean();
    const importEvent = await ImportEventModel.findById(result.importEventId).lean();

    expect(club?.name).toBe("River Plate Forever");
    expect(snapshot?.schemaVersion).toBe("atlas.youth-academy-snapshot.v0");
    expect(snapshot?.snapshotDate.toISOString()).toBe("2026-08-08T00:00:00.000Z");
    expect(snapshot?.weeklyInvestment).toMatchObject({ amount: 15000, currency: "ARS" });
    expect(snapshot?.players).toHaveLength(1);
    expect(snapshot?.players[0]).toMatchObject({
      playerId: 5001,
      name: "Matias Cantero",
      age: 16,
      initialWeeksRemaining: 4,
      weeksRemaining: 4,
      estimatedLevel: "good",
      status: "in_academy"
    });
    expect(importEvent?.snapshotId?.toString()).toBe(result.snapshotId);
  });

  it("rejects invalid youth academy JSON and persists the rejected import event", async () => {
    const result = await importYouthAcademySnapshot({ payload: invalidSnapshot });

    expect(result.status).toBe("rejected");
    expect(result.snapshotId).toBeNull();
    expect(result.clubId).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.map((error) => error.path)).toContain("academy.players.0.name");

    const importEvent = await ImportEventModel.findById(result.importEventId).lean();
    expect(importEvent?.status).toBe("rejected");
    expect(importEvent?.errors.length).toBeGreaterThan(0);
    expect(await YouthSnapshotModel.countDocuments()).toBe(0);
  });

  it("accepts youth academy JSON with warnings and persists them", async () => {
    const result = await importYouthAcademySnapshot({ payload: acceptedWithWarningsSnapshot });

    expect(result.status).toBe("accepted-with-warnings");
    expect(result.errors).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.snapshotId).not.toBeNull();

    const importEvent = await ImportEventModel.findById(result.importEventId).lean();
    expect(importEvent?.warnings.map((warning) => warning.path)).toContain(
      "academy.weeklyInvestment.currency"
    );
  });

  it("rejects youth player without playerId", async () => {
    const result = await importYouthAcademySnapshot({ payload: missingExternalIdSnapshot });

    expect(result.status).toBe("rejected");
    expect(result.snapshotId).toBeNull();
    expect(result.errors.map((error) => error.path)).toContain("academy.players.0.playerId");
    expect(await YouthSnapshotModel.countDocuments()).toBe(0);
  });

  it("associates successive youth snapshots to the same club", async () => {
    const first = await importYouthAcademySnapshot({ payload: validSnapshot });

    const secondPayload = structuredClone(validSnapshot) as YouthAcademySnapshotV0;
    secondPayload.snapshot.snapshotDate = "2026-08-15";
    secondPayload.snapshot.week = 7;

    const second = await importYouthAcademySnapshot({ payload: secondPayload });

    expect(second.clubId).toBe(first.clubId);

    const snapshots = await YouthSnapshotModel.find({ clubId: first.clubId })
      .sort({ snapshotDate: 1 })
      .lean();
    expect(snapshots).toHaveLength(2);
    expect(snapshots[0]?._id.toString()).toBe(first.snapshotId);
    expect(snapshots[1]?._id.toString()).toBe(second.snapshotId);
  });

  it("validates payload without persisting via validateYouthAcademySnapshotImport", () => {
    const validResult = validateYouthAcademySnapshotImport({ payload: validSnapshot });
    expect(validResult.status).toBe("accepted");

    const invalidResult = validateYouthAcademySnapshotImport({ payload: invalidSnapshot });
    expect(invalidResult.status).toBe("rejected");
  });
});
