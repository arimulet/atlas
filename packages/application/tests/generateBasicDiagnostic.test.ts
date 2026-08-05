import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import validSnapshot from "@atlas/test-fixtures/player-snapshot/valid.json" with { type: "json" };
import { ClubModel, ImportEventModel, PlayerModel, SnapshotModel } from "@atlas/database";
import { generateBasicDiagnosticForSnapshot, importPlayerSnapshot } from "../src/index.js";

let mongo: MongoMemoryServer;

describe("GenerateBasicDiagnostic", () => {
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

  it("generates a diagnostic from a persisted snapshot", async () => {
    const importResult = await importPlayerSnapshot({ payload: validSnapshot });

    const diagnostic = await generateBasicDiagnosticForSnapshot({
      snapshotId: importResult.snapshotId ?? "",
      generatedAt: new Date("2026-08-05T21:00:00.000Z")
    });

    expect(diagnostic.snapshotId).toBe(importResult.snapshotId);
    expect(diagnostic.generatedAt).toBe("2026-08-05T21:00:00.000Z");
    expect(diagnostic.findings.length).toBeGreaterThan(0);
    expect(diagnostic.findings.every((finding) => finding.evidence.length > 0)).toBe(true);
  });
});
