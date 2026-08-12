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
import extensionSnapshot from "@atlas/test-fixtures/player-snapshot/extension-sokker-dom-export.json" with {
  type: "json"
};
import sokkerPlayerBoxExtensionSnapshot from "@atlas/test-fixtures/player-snapshot/sokker-squad-player-box-export.json" with {
  type: "json"
};
import { ClubModel, ImportEventModel, PlayerModel, SnapshotModel } from "@atlas/database";
import type { PlayerSnapshotV0 } from "@atlas/contracts";
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
    expect(importEvent?.warnings.map((warning) => warning.path)).toContain(
      "players.0.skills.technique"
    );
  });

  it("rejects a player without playerId without creating an invalid player entity", async () => {
    const first = await importPlayerSnapshot({ payload: missingExternalIdSnapshot });
    const second = await importPlayerSnapshot({ payload: missingExternalIdSnapshot });

    expect(first.status).toBe("rejected");
    expect(second.status).toBe("rejected");
    expect(first.playerIds).toEqual([]);
    expect(second.playerIds).toEqual([]);
    expect(await PlayerModel.countDocuments()).toBe(0);
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
    expect(snapshot?.players[0]?.wage).toBe(12000);
    expect(snapshot?.players[0]?.value).toBe(450000);
    expect(importEvent?.snapshotId?.toString()).toBe(result.snapshotId);
  });

  it("imports XML players without an assigned training position", async () => {
    const payload = structuredClone(validSnapshot) as unknown as PlayerSnapshotV0;
    payload.source.type = "sokker-xml-import";
    payload.players[0]!.training.position = 0;

    const result = await importPlayerSnapshot({ payload });

    expect(result.status).toBe("accepted");
    expect(result.errors).toEqual([]);

    const snapshot = await SnapshotModel.findById(result.snapshotId).lean();
    expect(snapshot?.players[0]?.training.position).toBe(0);
  });

  it("links future snapshots to the same observed club while preserving manual profile settings", async () => {
    const first = await importPlayerSnapshot({ payload: validSnapshot });
    await ClubModel.findByIdAndUpdate(first.clubId, {
      $set: {
        "settings.currency": { name: "ARS", rate: 100 },
        "settings.assumptions": [
          {
            key: "liquidity-buffer",
            value: "Keep cash available for market windows.",
            updatedAt: new Date("2026-08-05T21:00:00.000Z")
          }
        ]
      }
    });

    const payload = structuredClone(validSnapshot) as unknown as PlayerSnapshotV0;
    payload.snapshot.snapshotDate = "2026-08-06";
    payload.snapshot.week = 5;

    const second = await importPlayerSnapshot({ payload });

    expect(second.clubId).toBe(first.clubId);

    const club = await ClubModel.findById(first.clubId).lean();
    const snapshots = await SnapshotModel.find({ clubId: first.clubId }).sort({ snapshotDate: 1 }).lean();

    expect(club?.week).toBe(5);
    expect(club?.settings?.currency).toMatchObject({ name: "ARS", rate: 100 });
    expect(club?.settings?.assumptions[0]?.key).toBe("liquidity-buffer");
    expect(snapshots.map((snapshot) => snapshot._id.toString())).toEqual([
      first.snapshotId,
      second.snapshotId
    ]);
  });

  it("imports a JSON fixture generated by the extension parser", async () => {
    const result = await importPlayerSnapshot({ payload: extensionSnapshot });

    expect(result.status).toBe("accepted");
    expect(result.importedPlayerCount).toBe(1);

    const snapshot = await SnapshotModel.findById(result.snapshotId).lean();
    expect(snapshot?.source?.type).toBe("sokker-dom-export");
    expect(snapshot?.players[0]?.playerId).toBe(101);
  });

  it("imports the representative Sokker player-box JSON generated by the extension parser", async () => {
    const result = await importPlayerSnapshot({ payload: sokkerPlayerBoxExtensionSnapshot });

    expect(result.status).toBe("accepted");
    expect(result.importedPlayerCount).toBe(2);

    const snapshot = await SnapshotModel.findById(result.snapshotId).lean();
    expect(snapshot?.snapshotDate.toISOString()).toBe("2026-08-06T00:00:00.000Z");
    expect(snapshot?.players.map((player) => player.playerId)).toEqual([38643161, 39409355]);
    expect(snapshot?.players[0]?.observedPosition).toBe("winger");
    expect(snapshot?.players[1]?.availabilityStatus).toBe("injured");
  });

  it("derives observedPosition during import when the squad page does not provide it", async () => {
    const payload = structuredClone(validSnapshot) as unknown as PlayerSnapshotV0;
    const player = payload.players[0]!;
    player.observedPosition = null;
    player.skills = {
      stamina: 8,
      pace: 10,
      technique: 9,
      passing: 8,
      keeper: 1,
      defender: 5,
      playmaker: 9,
      striker: 4
    };

    const result = await importPlayerSnapshot({ payload });

    expect(result.status).toBe("accepted");
    expect(result.warnings.map((warning) => warning.path)).not.toContain("players.0.observedPosition");

    const snapshot = await SnapshotModel.findById(result.snapshotId).lean();
    expect(snapshot?.players[0]?.observedPosition).toBe("winger");
  });
});
