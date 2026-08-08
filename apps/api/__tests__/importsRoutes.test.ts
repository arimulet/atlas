import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import Fastify from "fastify";
import importsRoutes from "../src/routes/imports/index.js";
import validSnapshot from "@atlas/test-fixtures/youth-academy-snapshot/valid.json" with {
  type: "json"
};
import invalidSnapshot from "@atlas/test-fixtures/youth-academy-snapshot/invalid.json" with {
  type: "json"
};
import { ClubModel, ImportEventModel, YouthSnapshotModel } from "@atlas/database";

let mongo: MongoMemoryServer;

describe("POST /api/imports/youth-academy", () => {
  const server = Fastify();

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    server.register(importsRoutes, { prefix: "/api/imports" });
    await server.ready();
  });

  beforeEach(async () => {
    await Promise.all([
      ClubModel.deleteMany({}),
      ImportEventModel.deleteMany({}),
      YouthSnapshotModel.deleteMany({})
    ]);
  });

  afterAll(async () => {
    await server.close();
    await mongoose.disconnect();
    await mongo.stop();
  });

  it("successfully imports youth academy snapshot via POST /api/imports/youth-academy", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/api/imports/youth-academy",
      payload: validSnapshot
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe("accepted");
    expect(body.snapshotId).toBeTruthy();
    expect(body.clubId).toBeTruthy();
    expect(body.importedPlayerCount).toBe(1);

    const snapshot = await YouthSnapshotModel.findById(body.snapshotId).lean();
    expect(snapshot?.players[0]?.name).toBe("Matias Cantero");
  });

  it("returns 422 for invalid youth academy snapshot via POST /api/imports/youth-academy", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/api/imports/youth-academy",
      payload: invalidSnapshot
    });

    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.body);
    expect(body.status).toBe("rejected");
    expect(body.errors.length).toBeGreaterThan(0);
  });

  it("validates payload without persisting via POST /api/imports/youth-academy/validate", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/api/imports/youth-academy/validate",
      payload: validSnapshot
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe("accepted");
    expect(await YouthSnapshotModel.countDocuments()).toBe(0);
  });
});
