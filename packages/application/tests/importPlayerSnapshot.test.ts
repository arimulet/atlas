import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import validSnapshot from "@atlas/test-fixtures/player-snapshot/valid.json" with { type: "json" };
import invalidSnapshot from "@atlas/test-fixtures/player-snapshot/invalid.json" with { type: "json" };
import acceptedWithWarningsSnapshot from "@atlas/test-fixtures/player-snapshot/accepted-with-warnings.json" with {
  type: "json"
};
import missingExternalIdSnapshot from "@atlas/test-fixtures/player-snapshot/missing-external-id.json" with {
  type: "json"
};
import missingSkillSnapshot from "@atlas/test-fixtures/player-snapshot/missing-skill.json" with { type: "json" };
import { ClubModel, ImportEventModel, PlayerModel, SnapshotModel } from "@atlas/database";
import { importPlayerSnapshot } from "../src/index.js";

let mongo: MongoMemoryServer;

describe("ImportPlayerSnapshot", () => {
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

  it("imports valid JSON", async () => {
    const result = await importPlayerSnapshot({ payload: validSnapshot });

    expect(result.status).toBe("accepted");
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.snapshotId).toEqual(expect.any(String));
    expect(result.importedPlayerCount).toBe(1);
  });

  it("rejects invalid JSON and persists the rejected import event", async () => {
    const result = await importPlayerSnapshot({ payload: invalidSnapshot });

    expect(result.status).toBe("rejected");
    expect(result.snapshotId).toBeNull();
    expect(result.errors.map((error) => error.path)).toContain("players.0.name");

    const importEvent = await ImportEventModel.findById(result.importEventId).lean();
    expect(importEvent?.status).toBe("rejected");
    expect(importEvent?.errors.length).toBeGreaterThan(0);
    expect(await SnapshotModel.countDocuments()).toBe(0);
  });

  it("accepts JSON with warnings and persists them", async () => {
    const result = await importPlayerSnapshot({ payload: acceptedWithWarningsSnapshot });

    expect(result.status).toBe("accepted-with-warnings");
    expect(result.errors).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);

    const importEvent = await ImportEventModel.findById(result.importEventId).lean();
    expect(importEvent?.warnings.map((warning) => warning.path)).toContain("players.0.externalId");
  });

  it("accepts a player without externalId without reusing a doubtful identity", async () => {
    const first = await importPlayerSnapshot({ payload: missingExternalIdSnapshot });
    const second = await importPlayerSnapshot({ payload: missingExternalIdSnapshot });

    expect(first.status).toBe("accepted-with-warnings");
    expect(second.status).toBe("accepted-with-warnings");
    expect(first.playerIds[0]).not.toBe(second.playerIds[0]);
    expect(await PlayerModel.countDocuments({ externalId: null })).toBe(2);
  });

  it("accepts a missing skill as a non-blocking warning", async () => {
    const result = await importPlayerSnapshot({ payload: missingSkillSnapshot });

    expect(result.status).toBe("accepted-with-warnings");
    expect(result.warnings.map((warning) => warning.path)).toContain("players.0.skills.technique");

    const snapshot = await SnapshotModel.findById(result.snapshotId).lean();
    expect(snapshot?.players[0]?.skills.technique).toBeNull();
  });

  it("persists the snapshot with normalized club, source and player data", async () => {
    const result = await importPlayerSnapshot({ payload: validSnapshot });

    const snapshot = await SnapshotModel.findById(result.snapshotId).lean();
    const club = await ClubModel.findById(result.clubId).lean();
    const importEvent = await ImportEventModel.findById(result.importEventId).lean();

    expect(club?.name).toBe("River Plate Forever");
    expect(snapshot?.schemaVersion).toBe("atlas.player-snapshot.v0");
    expect(snapshot?.snapshotDate.toISOString()).toBe("2026-08-05T00:00:00.000Z");
    expect(snapshot?.source?.exportedAt.toISOString()).toBe("2026-08-05T20:00:00.000Z");
    expect(snapshot?.players).toHaveLength(1);
    expect(snapshot?.players[0]?.name).toBe("Tomas Alvarez");
    expect(snapshot?.players[0]?.wage).toMatchObject({ amount: 12000, currency: "ARS" });
    expect(importEvent?.snapshotId?.toString()).toBe(result.snapshotId);
  });
});
