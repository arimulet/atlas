import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MatchModel, MongoMatchRepository, type SaveMatchInput } from "../src/index.js";

let mongo: MongoMemoryServer;
const matches = new MongoMatchRepository();

describe("MongoMatchRepository", () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  beforeEach(async () => {
    await MatchModel.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it("persists matches once and lists them by club and game week", async () => {
    const input = buildMatchInput({ id: 44421295, clubId: 6038, gameWeek: 1204 });

    const saved = await matches.save(input);
    const sameSavedMatch = await matches.save(input);

    expect(saved.id).toBe(44421295);
    expect(sameSavedMatch.id).toBe(saved.id);
    expect(await MatchModel.countDocuments()).toBe(1);
    expect(await matches.exists(44421295)).toBe(true);
    expect((await matches.listByClubAndGameWeek(6038, 1204)).map((match) => match.id)).toEqual([
      44421295
    ]);
  });

  it("does not return matches from another club or week", async () => {
    await matches.save(buildMatchInput({ id: 1, clubId: 6038, gameWeek: 1204 }));
    await matches.save(buildMatchInput({ id: 2, clubId: 6038, gameWeek: 1205 }));
    await matches.save(buildMatchInput({ id: 3, clubId: 78183, gameWeek: 1204 }));

    expect((await matches.listByClub(6038)).map((match) => match.id)).toEqual([1, 2]);
    expect((await matches.listByClubAndGameWeek(6038, 1204)).map((match) => match.id)).toEqual([1]);
  });
});

function buildMatchInput(overrides: {
  id: number;
  clubId: number;
  gameWeek: number;
}): SaveMatchInput {
  return {
    id: overrides.id,
    clubId: overrides.clubId,
    gameWeek: overrides.gameWeek,
    week: 7,
    playedAt: new Date("2026-08-14T23:29:00.000Z"),
    leagueId: 1295,
    matchType: "FRIENDLY",
    side: "HOME",
    opponent: { id: 78183, name: "Flynet Football Club" },
    score: { club: 1, opponent: 5 },
    players: [
      {
        playerId: 1,
        number: 1,
        formation: "GK",
        role: "STARTER",
        timeIn: 0,
        timeOut: 0,
        minutesPlayed: 90
      }
    ]
  };
}
