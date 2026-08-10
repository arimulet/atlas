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
    const club = await clubs.save({ externalId: "club-001", name: "River Plate Forever" });
    const player = await players.resolveHistoricalIdentity({
      externalId: "player-001",
      name: "Tomas Alvarez"
    });

    const saved = await snapshots.save(
      buildSnapshotInput({ clubId: club.id, playerId: player.id })
    );

    expect(saved.id).toEqual(expect.any(String));
    expect(saved.clubId).toBe(club.id);
    expect(saved.schemaVersion).toBe("atlas.player-snapshot.v0");
    expect(saved.players).toHaveLength(1);
    expect(saved.players[0]).toMatchObject({
      playerId: player.id,
      externalId: "player-001",
      name: "Tomas Alvarez",
      wage: { amount: 12000, currency: "ARS" }
    });
  });

  it("persists observed club profile separately from manual configuration", async () => {
    const club = await clubs.save({
      externalId: "club-001",
      name: "River Plate Forever",
      season: 78,
      week: 4,
      lastSnapshotDate: new Date("2026-08-05T00:00:00.000Z"),
      sourceType: "sokker-dom-export",
      observedAt: new Date("2026-08-05T20:00:00.000Z")
    });

    expect(club.observed).toMatchObject({
      externalId: "club-001",
      name: "River Plate Forever",
      season: 78,
      week: 4,
      sourceType: "sokker-dom-export"
    });
    expect(club.manual).toMatchObject({
      name: null,
      currency: null,
      season: null,
      week: null,
      assumptions: [],
      preferences: []
    });
    expect(club.profile).toMatchObject({
      externalId: "club-001",
      name: "River Plate Forever",
      currency: null,
      season: 78,
      week: 4
    });
    expect(club.settings).toMatchObject({
      observed: {
        season: 78,
        week: 4
      },
      manual: {
        currency: null,
        season: null,
        week: null,
        preferences: []
      },
      effective: {
        currency: null,
        season: 78,
        week: 4,
        preferences: []
      }
    });
  });

  it("updates manual club configuration without changing observed Sokker data", async () => {
    const club = await clubs.save({
      externalId: "club-001",
      name: "River Plate Forever",
      season: 78,
      week: 4
    });

    const updated = await clubs.updateManualProfile({
      clubId: club.id,
      name: "River Project",
      currency: "ARS",
      season: 79,
      assumptions: [{ key: "market-risk", value: "Keep liquidity buffer before buying." }],
      preferences: [{ key: "training-focus", value: "Prioritize playmaking trainees." }]
    });

    expect(updated.observed).toMatchObject({
      externalId: "club-001",
      name: "River Plate Forever",
      season: 78,
      week: 4
    });
    expect(updated.manual).toMatchObject({
      name: "River Project",
      currency: "ARS",
      season: 79,
      week: null
    });
    expect(updated.manual.assumptions[0]).toMatchObject({
      key: "market-risk",
      value: "Keep liquidity buffer before buying."
    });
    expect(updated.profile).toMatchObject({
      externalId: "club-001",
      name: "River Project",
      currency: "ARS",
      season: 79,
      week: 4
    });
  });

  it("retrieves a snapshot by id", async () => {
    const club = await clubs.save({ externalId: "club-001", name: "River Plate Forever" });
    const player = await players.resolveHistoricalIdentity({
      externalId: "player-001",
      name: "Tomas Alvarez"
    });
    const saved = await snapshots.save(
      buildSnapshotInput({ clubId: club.id, playerId: player.id })
    );

    const found = await snapshots.findById(saved.id);

    expect(found?.id).toBe(saved.id);
    expect(found?.snapshotDate.toISOString()).toBe("2026-08-05T00:00:00.000Z");
  });

  it("lists snapshots for a club", async () => {
    const club = await clubs.save({ externalId: "club-001", name: "River Plate Forever" });
    const otherClub = await clubs.save({ externalId: "club-002", name: "Atlas Wanderers" });
    const player = await players.resolveHistoricalIdentity({
      externalId: "player-001",
      name: "Tomas Alvarez"
    });

    await snapshots.save(
      buildSnapshotInput({
        clubId: club.id,
        playerId: player.id,
        snapshotDate: new Date("2026-08-06T00:00:00.000Z")
      })
    );
    await snapshots.save(buildSnapshotInput({ clubId: club.id, playerId: player.id }));
    await snapshots.save(buildSnapshotInput({ clubId: otherClub.id, playerId: player.id }));

    const list = await snapshots.listByClub(club.id);

    expect(list.map((snapshot) => snapshot.clubId)).toEqual([club.id, club.id]);
    expect(list.map((snapshot) => snapshot.snapshotDate.toISOString())).toEqual([
      "2026-08-05T00:00:00.000Z",
      "2026-08-06T00:00:00.000Z"
    ]);
  });

  it("retrieves snapshots by club and date", async () => {
    const club = await clubs.save({ externalId: "club-001", name: "River Plate Forever" });
    const player = await players.resolveHistoricalIdentity({
      externalId: "player-001",
      name: "Tomas Alvarez"
    });
    const snapshotDate = new Date("2026-08-05T00:00:00.000Z");

    const saved = await snapshots.save(
      buildSnapshotInput({ clubId: club.id, playerId: player.id, snapshotDate })
    );

    const found = await snapshots.findByClubAndDate(club.id, snapshotDate);

    expect(found.map((snapshot) => snapshot.id)).toEqual([saved.id]);
  });

  it("reuses a player identity across snapshots when externalId matches", async () => {
    const first = await players.resolveHistoricalIdentity({
      externalId: "player-001",
      name: "Tomas Alvarez"
    });
    const second = await players.resolveHistoricalIdentity({
      externalId: "player-001",
      name: "T. Alvarez"
    });

    expect(second.id).toBe(first.id);
    expect(await PlayerModel.countDocuments()).toBe(1);
  });

  it("does not automatically merge players without externalId", async () => {
    const first = await players.resolveHistoricalIdentity({
      externalId: null,
      name: "Tomas Alvarez"
    });
    const second = await players.resolveHistoricalIdentity({
      externalId: null,
      name: "Tomas Alvarez"
    });

    expect(second.id).not.toBe(first.id);
    expect(await PlayerModel.countDocuments({ externalId: null })).toBe(2);
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
    const club = await clubs.save({ externalId: "club-001", name: "River Plate Forever" });
    const snapshotDate = new Date("2026-08-08T00:00:00.000Z");

    const input: SaveYouthSnapshotInput = buildYouthSnapshotInput({
      clubId: club.id,
      snapshotDate
    });

    const saved = await youthSnapshots.save(input);

    expect(saved.id).toEqual(expect.any(String));
    expect(saved.clubId).toBe(club.id);
    expect(saved.schemaVersion).toBe("atlas.youth-academy-snapshot.v0");
    expect(saved.weeklyInvestment).toEqual({ amount: 15000, currency: "ARS" });
    expect(saved.players).toHaveLength(1);
    expect(saved.players[0]).toMatchObject({
      externalId: "youth-101",
      name: "Matias Cantero",
      age: 16,
      weeksInAcademy: 12,
      weeksRemaining: 4,
      estimatedLevel: "good",
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
  playerId: string;
  snapshotDate?: Date;
}): SaveSnapshotInput {
  return {
    clubId: overrides.clubId,
    schemaVersion: "atlas.player-snapshot.v0",
    snapshotDate: overrides.snapshotDate ?? new Date("2026-08-05T00:00:00.000Z"),
    season: 78,
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
        externalId: "player-001",
        name: "Tomas Alvarez",
        age: 22,
        wage: { amount: 12000, currency: "ARS" },
        estimatedValue: { amount: 450000, currency: "ARS" },
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
        roles: []
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
    season: 78,
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
        externalId: "youth-101",
        name: "Matias Cantero",
        age: 16,
        weeksInAcademy: 12,
        initialWeeksRemaining: null,
        weeksRemaining: 4,
        estimatedLevel: "good",
        status: "in_academy"
      }
    ]
  };
}
