import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  ClubModel,
  ImportEventModel,
  MongoClubRepository,
  MongoImportEventRepository,
  MongoPlayerRepository,
  MongoSnapshotRepository,
  MongoYouthSnapshotRepository,
  PlayerModel,
  SnapshotModel,
  YouthSnapshotModel,
  type SaveSnapshotInput,
  type SaveYouthSnapshotInput
} from "../src/index.js";

let mongo: MongoMemoryServer;

const clubs = new MongoClubRepository();
const importEvents = new MongoImportEventRepository();
const players = new MongoPlayerRepository();
const snapshots = new MongoSnapshotRepository();
const youthSnapshots = new MongoYouthSnapshotRepository();

describe("Mongo repositories", () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  beforeEach(async () => {
    await Promise.all([
      ClubModel.deleteMany({}),
      ImportEventModel.deleteMany({}),
      PlayerModel.deleteMany({}),
      SnapshotModel.deleteMany({}),
      YouthSnapshotModel.deleteMany({})
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it("saves a valid normalized snapshot", async () => {
    const club = await clubs.save({ clubId: 1, country: 1, name: "River Plate Forever", currency: { name: "ARS", rate: 100 } });
    const player = await players.resolveHistoricalIdentity({
      playerId: 1001,
      clubId: club.clubId,
      name: "Tomas Alvarez"
    });

    const saved = await snapshots.save(
      buildSnapshotInput({ clubId: club.id, playerId: player.playerId })
    );

    expect(saved.id).toEqual(expect.any(String));
    expect(saved.clubId).toBe(club.id);
    expect(saved.schemaVersion).toBe("atlas.player-snapshot.v0");
    expect(saved.gameWeek).toBe(1201);
    expect(saved.week).toBe(4);
    expect(saved.players).toHaveLength(1);
    expect(saved.players[0]).toMatchObject({
      playerId: player.playerId,
      name: "Tomas Alvarez",
      wage: 12000,
      value: 450000
    });
  });

  it("persists observed club profile separately from manual configuration", async () => {
    const club = await clubs.save({
      clubId: 1, country: 1,
      name: "River Plate Forever",
      week: 4,
      lastSnapshotDate: new Date("2026-08-05T00:00:00.000Z"),
      sourceType: "sokker-dom-export",
      observedAt: new Date("2026-08-05T20:00:00.000Z"),
      currency: { name: "ARS", rate: 100 }
    });

    expect(club).toMatchObject({
      clubId: 1,
      name: "River Plate Forever",
      week: 4,
      sourceType: "sokker-dom-export"
    });
    expect(club.settings).toMatchObject({
      currency: { name: "ARS", rate: 100 },
      week: null,
      assumptions: [],
      preferences: [
        { key: "economy.riskTolerance", value: "balanced" },
        { key: "training.priority", value: "balanced" },
        { key: "academy.investment", value: "balanced" },
        { key: "market.strategy", value: "balanced" }
      ]
    });
    // The settings assertions above replace this block.
  });

  it("updates manual club configuration without changing observed Sokker data", async () => {
    const club = await clubs.save({
      clubId: 1,
      country: 1,
      name: "River Plate Forever",
      week: 4,
      currency: { name: "ARS", rate: 100 }
    });

    const updated = await clubs.updateManualProfile({
      clubId: club.id,
      currency: { name: "ARS", rate: 100 },
      assumptions: [{ key: "market-risk", value: "Keep liquidity buffer before buying." }],
      preferences: [{ key: "training-focus", value: "Prioritize playmaking trainees." }]
    });

    expect(updated).toMatchObject({
      clubId: 1,
      name: "River Plate Forever",
      week: 4
    });
    expect(updated.settings).toMatchObject({
      currency: { name: "ARS", rate: 100 },
      week: null
    });
    expect(updated.settings.assumptions[0]).toMatchObject({
      key: "market-risk",
      value: "Keep liquidity buffer before buying."
    });
  });

  it("retrieves a snapshot by id", async () => {
    const club = await clubs.save({ clubId: 1, country: 1, name: "River Plate Forever", currency: { name: "ARS", rate: 100 } });
    const player = await players.resolveHistoricalIdentity({
      playerId: 1001,
      clubId: club.clubId,
      name: "Tomas Alvarez"
    });
    const saved = await snapshots.save(
      buildSnapshotInput({ clubId: club.id, playerId: player.playerId })
    );

    const found = await snapshots.findById(saved.id);

    expect(found?.id).toBe(saved.id);
    expect(found?.snapshotDate.toISOString()).toBe("2026-08-05T00:00:00.000Z");
  });

  it("lists snapshots for a club", async () => {
    const club = await clubs.save({ clubId: 1, country: 1, name: "River Plate Forever", currency: { name: "ARS", rate: 100 } });
    const otherClub = await clubs.save({ clubId: 2, country: 1, name: "Atlas Wanderers", currency: { name: "ARS", rate: 100 } });
    const player = await players.resolveHistoricalIdentity({
      playerId: 1001,
      clubId: club.clubId,
      name: "Tomas Alvarez"
    });

    await snapshots.save(
      buildSnapshotInput({
        clubId: club.id,
        playerId: player.playerId,
        snapshotDate: new Date("2026-08-06T00:00:00.000Z")
      })
    );
    await snapshots.save(buildSnapshotInput({ clubId: club.id, playerId: player.playerId }));
    await snapshots.save(buildSnapshotInput({ clubId: otherClub.id, playerId: player.playerId }));

    const list = await snapshots.listByClub(club.id);

    expect(list.map((snapshot) => snapshot.clubId)).toEqual([club.id, club.id]);
    expect(list.map((snapshot) => snapshot.snapshotDate.toISOString())).toEqual([
      "2026-08-05T00:00:00.000Z",
      "2026-08-06T00:00:00.000Z"
    ]);
  });

  it("retrieves snapshots by club and date", async () => {
    const club = await clubs.save({ clubId: 1, country: 1, name: "River Plate Forever", currency: { name: "ARS", rate: 100 } });
    const player = await players.resolveHistoricalIdentity({
      playerId: 1001,
      clubId: club.clubId,
      name: "Tomas Alvarez"
    });
    const snapshotDate = new Date("2026-08-05T00:00:00.000Z");

    const saved = await snapshots.save(
      buildSnapshotInput({ clubId: club.id, playerId: player.playerId, snapshotDate })
    );

    const found = await snapshots.findByClubAndDate(club.id, snapshotDate);

    expect(found.map((snapshot) => snapshot.id)).toEqual([saved.id]);
  });

  it("reuses a player identity across snapshots when playerId matches", async () => {
    const first = await players.resolveHistoricalIdentity({
      playerId: 1001,
      clubId: 1,
      name: "Tomas Alvarez"
    });
    const second = await players.resolveHistoricalIdentity({
      playerId: 1001,
      clubId: 1,
      name: "T. Alvarez"
    });

    expect(second.id).toBe(first.id);
    expect(await PlayerModel.countDocuments()).toBe(1);
  });

  it("keeps player identities separated by clubId", async () => {
    const first = await players.resolveHistoricalIdentity({
      playerId: 1001,
      clubId: 1,
      name: "Tomas Alvarez"
    });
    const second = await players.resolveHistoricalIdentity({
      playerId: 1001,
      clubId: 2,
      name: "Tomas Alvarez"
    });

    expect(second.id).not.toBe(first.id);
    expect(second.clubId).toBe(2);
    expect(await PlayerModel.countDocuments()).toBe(2);
  });

  it("requires playerId when creating a player", async () => {
    await expect(PlayerModel.create({ clubId: 1, name: "Tomas Alvarez" })).rejects.toThrow(
      /playerId/
    );
  });

  it("requires clubId when creating a player", async () => {
    await expect(PlayerModel.create({ playerId: 1001, name: "Tomas Alvarez" })).rejects.toThrow(
      /clubId/
    );
  });

  it("persists an import event with warnings", async () => {
    const event = await importEvents.create({
      schemaVersion: "atlas.player-snapshot.v0",
      sourceType: "sokker-dom-export",
      status: "accepted-with-warnings",
      errors: [],
      warnings: [
        {
          path: "players.0.externalId",
          message: "Missing externalId; player identity may require manual review."
        }
      ]
    });

    const found = await importEvents.findById(event.id);

    expect(found?.status).toBe("accepted-with-warnings");
    expect(found?.warnings).toEqual([
      {
        path: "players.0.externalId",
        message: "Missing externalId; player identity may require manual review."
      }
    ]);
  });

  it("saves and retrieves a valid youth academy snapshot", async () => {
    const club = await clubs.save({ clubId: 1, country: 1, name: "River Plate Forever", currency: { name: "ARS", rate: 100 } });
    const snapshotDate = new Date("2026-08-08T00:00:00.000Z");

    const input: SaveYouthSnapshotInput = buildYouthSnapshotInput({
      clubId: club.id,
      snapshotDate
    });

    const saved = await youthSnapshots.save(input);

    expect(saved.id).toEqual(expect.any(String));
    expect(saved.clubId).toBe(club.id);
    expect(saved.schemaVersion).toBe("atlas.youth-academy-snapshot.v0");
    expect(saved.gameWeek).toBe(1203);
    expect(saved.week).toBe(6);
    expect(saved.weeklyInvestment).toEqual({ amount: 15000, currency: "ARS" });
    expect(saved.players).toHaveLength(1);
    expect(saved.players[0]).toMatchObject({
      playerId: 5001,
      name: "Matias Cantero",
      age: 16,
      weeksRemaining: 4,
      skill: 8,
      status: "in_academy"
    });

    const found = await youthSnapshots.findById(saved.id);
    expect(found?.id).toBe(saved.id);

    const list = await youthSnapshots.listByClub(club.id);
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(saved.id);

    const byDate = await youthSnapshots.findByClubAndDate(club.id, snapshotDate);
    expect(byDate).toHaveLength(1);
    expect(byDate[0]?.id).toBe(saved.id);
  });
});

function buildSnapshotInput(overrides: {
  clubId: string;
  playerId: number;
  snapshotDate?: Date;
}): SaveSnapshotInput {
  return {
    clubId: overrides.clubId,
    schemaVersion: "atlas.player-snapshot.v0",
    snapshotDate: overrides.snapshotDate ?? new Date("2026-08-05T00:00:00.000Z"),
    gameWeek: 1201,
    week: 4,
    importedAt: new Date("2026-08-05T20:00:00.000Z"),
    source: {
      type: "sokker-dom-export",
      exportedAt: new Date("2026-08-05T20:00:00.000Z"),
      pageUrl: "https://example.sokker.org/players",
      locale: "es-AR"
    },
    players: [
      {
        playerId: overrides.playerId,
        name: "Tomas Alvarez",
        age: 22,
        wage: 12000,
        value: 450000,
        training: { position: 3, advanced: false },
        form: 10,
        availabilityStatus: "available",
        observedPosition: "midfielder",
        skills: {
          stamina: 8,
          pace: 10,
          technique: 9,
          passing: 8,
          keeper: 1,
          defender: 5,
          playmaker: 9,
          striker: 4
        },

      }
    ]
  };
}

function buildYouthSnapshotInput(overrides: {
  clubId: string;
  snapshotDate?: Date;
}): SaveYouthSnapshotInput {
  return {
    clubId: overrides.clubId,
    schemaVersion: "atlas.youth-academy-snapshot.v0",
    snapshotDate: overrides.snapshotDate ?? new Date("2026-08-08T00:00:00.000Z"),
    gameWeek: 1203,
    week: 6,
    importedAt: new Date("2026-08-08T10:00:00.000Z"),
    source: {
      type: "sokker-dom-export",
      exportedAt: new Date("2026-08-08T10:00:00.000Z"),
      pageUrl: "https://sokker.org/app/juniors",
      locale: "es-AR"
    },
    weeklyInvestment: { amount: 15000, currency: "ARS" },
    players: [
      {
        playerId: 5001,
        name: "Matias Cantero",
        age: 16,
        initialWeeksRemaining: null,
        weeksRemaining: 4,
        skill: 8,
        status: "in_academy"
      }
    ]
  };
}
