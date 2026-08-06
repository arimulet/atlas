import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ClubModel, MongoClubRepository } from "@atlas/database";
import { getClubProfile, updateClubProfile } from "../src/index.js";

let mongo: MongoMemoryServer;

const clubs = new MongoClubRepository();

describe("Club profile use cases", () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  beforeEach(async () => {
    await ClubModel.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it("reads a minimal operational profile", async () => {
    const club = await clubs.save({
      externalId: "club-001",
      name: "River Plate Forever",
      season: 78,
      week: 4
    });

    const profile = await getClubProfile({ clubId: club.id });

    expect(profile.profile).toMatchObject({
      externalId: "club-001",
      name: "River Plate Forever",
      currency: null,
      season: 78,
      week: 4
    });
  });

  it("updates manual assumptions and preferences separately from observed values", async () => {
    const club = await clubs.save({
      externalId: "club-001",
      name: "River Plate Forever",
      season: 78,
      week: 4
    });

    const profile = await updateClubProfile({
      clubId: club.id,
      manual: {
        currency: "ARS",
        week: 6,
        assumptions: [{ key: "wage-growth", value: "Use conservative wage growth." }],
        preferences: [{ key: "market-style", value: "Avoid short-term flips." }]
      }
    });

    expect(profile.observed.week).toBe(4);
    expect(profile.manual.week).toBe(6);
    expect(profile.profile.week).toBe(6);
    expect(profile.profile.currency).toBe("ARS");
    expect(profile.manual.assumptions[0]?.key).toBe("wage-growth");
    expect(profile.manual.preferences[0]?.key).toBe("market-style");
  });
});
