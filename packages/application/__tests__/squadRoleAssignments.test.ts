import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ClubModel, getSquadRoleAssignmentModel, MongoClubRepository } from "@atlas/database";
import {
  getSquadRoleAssignment,
  resetSquadRoleAssignment,
  saveSquadRoleAssignment
} from "../src/squadPlanning/index.js";

let mongo: MongoMemoryServer;

const clubs = new MongoClubRepository();

describe("squad role assignments", () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  beforeEach(async () => {
    await Promise.all([ClubModel.deleteMany({}), getSquadRoleAssignmentModel().deleteMany({})]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it("resolves a club document id before persisting a player role", async () => {
    const club = await clubs.save({
      clubId: 1,
      country: 1,
      name: "River Plate Forever",
      training: { GK: 2, DEF: 6, MID: 4, ATT: 7 },
      currency: "ARS"
    });

    const saved = await saveSquadRoleAssignment({
      clubId: club.id,
      playerId: 100,
      role: "core"
    });
    const fetched = await getSquadRoleAssignment({ clubId: club.id, playerId: 100 });

    expect(saved).toMatchObject({ clubId: 1, playerId: 100, role: "core" });
    expect(fetched).toMatchObject({ clubId: 1, playerId: 100, role: "core" });

    await resetSquadRoleAssignment({ clubId: club.id, playerId: 100 });

    await expect(getSquadRoleAssignment({ clubId: club.id, playerId: 100 })).resolves.toBeNull();
  });
});
