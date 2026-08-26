import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  ClubModel,
  JuniorModel,
  MongoClubRepository,
  MongoJuniorRepository,
  MongoPlayerDevelopmentTargetRepository,
  MongoSquadRoleAssignmentRepository,
  MongoPlayerRepository,
  MongoSnapshotRepository,
  PlayerModel,
  PlayerTransferModel,
  getPlayerDevelopmentTargetModel,
  getSquadRoleAssignmentModel,
  SnapshotModel,
  migrateClubProfileDocuments,
  migrateDevelopmentProfileKeys,
  migrateSnapshotClubIds,
  type SaveSnapshotInput
} from "../src/index.js";

let mongo: MongoMemoryServer;

const clubs = new MongoClubRepository();
const juniors = new MongoJuniorRepository();
const players = new MongoPlayerRepository();
const developmentTargets = new MongoPlayerDevelopmentTargetRepository();
const squadRoleAssignments = new MongoSquadRoleAssignmentRepository();
const snapshots = new MongoSnapshotRepository();

describe("Mongo repositories", () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  beforeEach(async () => {
    await Promise.all([
      ClubModel.deleteMany({}),
      JuniorModel.deleteMany({}),
      PlayerModel.deleteMany({}),
      PlayerTransferModel.deleteMany({}),
      getPlayerDevelopmentTargetModel().deleteMany({}),
      getSquadRoleAssignmentModel().deleteMany({}),
      SnapshotModel.deleteMany({})
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it("saves a valid normalized snapshot", async () => {
    const club = await clubs.save({
      clubId: 1,
      country: 1,
      name: "River Plate Forever",
      training: { GK: 2, DEF: 6, MID: 4, ATT: 7 },
      currency: "ARS"
    });
    const player = await players.resolveHistoricalIdentity({
      playerId: 1001,
      clubId: club.clubId,
      name: "Tomas Alvarez"
    });

    const saved = await snapshots.save(
      buildSnapshotInput({ clubId: club.clubId, playerId: player.playerId })
    );

    expect(saved.id).toEqual(expect.any(String));
    expect(saved.clubId).toBe(club.clubId);
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
    expect(saved.juniors).toHaveLength(1);
    expect((await SnapshotModel.findById(saved.id).lean())?.players[0]).not.toHaveProperty("name");
    expect(Object.hasOwn((await SnapshotModel.findById(saved.id).lean()) ?? {}, "source")).toBe(
      false
    );
    expect(saved.juniors[0]).toMatchObject({
      playerId: 5001,
      name: "Matias Cantero",
      age: 16,
      initialLevel: 8,
      weeksRemaining: 4,
      skill: 8,
      status: "in_academy"
    });
  });

  it("keeps the current junior state by club and external id", async () => {
    const first = await juniors.resolveCurrentIdentity({
      juniorId: 5001,
      clubId: 1,
      name: "Matias Cantero",
      age: 16,
      currentLevel: 8,
      weeksLeft: 4
    });
    const second = await juniors.resolveCurrentIdentity({
      juniorId: 5001,
      clubId: 1,
      name: "Matias Cantero",
      age: 17,
      currentLevel: 9,
      weeksLeft: 0
    });

    await juniors.markMissingStatuses(1, [], [5001]);

    expect(second.id).toBe(first.id);
    expect(await JuniorModel.countDocuments({ clubId: 1, juniorId: 5001 })).toBe(1);
    expect(await juniors.findByJuniorId({ clubId: 1, juniorId: 5001 })).toMatchObject({
      age: 17,
      initialAge: 16,
      initialLevel: 8,
      currentLevel: 9,
      initialWeeks: 4,
      weeksLeft: 0,
      status: "promoted"
    });
  });

  it("migrates legacy club budget and currency fields without deleting the document", async () => {
    const inserted = await ClubModel.collection.insertOne({
      clubId: 99,
      country: 1,
      name: "Legacy Club",
      budget: { value: 13221420, currency: "ARS" },
      settings: { currency: { name: "ARS", rate: 1 }, preferences: [] }
    });

    const result = await migrateClubProfileDocuments();
    const migrated = await ClubModel.collection.findOne({ _id: inserted.insertedId });

    expect(result.migrated).toBe(1);
    expect(migrated?.budget).toBe(13221420);
    expect(migrated?.currency).toBe("ARS");
    expect(migrated).not.toHaveProperty("budget.value");
    expect(migrated).not.toHaveProperty("settings.currency");
  });

  it("persists observed club profile separately from manual configuration", async () => {
    const club = await clubs.save({
      clubId: 1,
      country: 1,
      name: "River Plate Forever",
      week: 4,
      lastSnapshotDate: new Date("2026-08-05T00:00:00.000Z"),
      observedAt: new Date("2026-08-05T20:00:00.000Z"),
      training: { GK: 2, DEF: 6, MID: 4, ATT: 7 },
      currency: "ARS"
    });

    expect(club).toMatchObject({
      clubId: 1,
      name: "River Plate Forever",
      week: 4
    });
    expect(club).not.toHaveProperty("sourceType");
    expect(club).toMatchObject({ currency: "ARS" });
    expect(club.settings).toMatchObject({
      week: null,
      assumptions: [],
      preferences: [
        { key: "economy.riskTolerance", value: "balanced" },
        { key: "training.priority", value: "balanced" },
        { key: "academy.investment", value: "balanced" },
        { key: "market.strategy", value: "balanced" }
      ]
    });
  });

  it("migrates legacy snapshot ObjectId references to numeric club ids", async () => {
    const club = await clubs.save({
      clubId: 1,
      country: 1,
      name: "River Plate Forever",
      training: { GK: 2, DEF: 6, MID: 4, ATT: 7 },
      currency: "ARS"
    });
    const inserted = await SnapshotModel.collection.insertOne({
      clubId: new mongoose.Types.ObjectId(club.id),
      schemaVersion: "atlas.player-snapshot.v0",
      snapshotDate: new Date("2026-08-05T00:00:00.000Z"),
      importedAt: new Date("2026-08-05T20:00:00.000Z"),
      players: [],
      juniors: []
    });

    const result = await migrateSnapshotClubIds();
    const migrated = await SnapshotModel.collection.findOne({ _id: inserted.insertedId });

    expect(result.migrated).toBe(1);
    expect(migrated?.clubId).toBe(1);
  });

  it("migrates legacy development profile keys", async () => {
    const developmentTarget = await getPlayerDevelopmentTargetModel().collection.insertOne({
      playerId: 100,
      clubId: 1,
      profile: "central_defender",
      targetLevels: {},
      targetAge: null
    });
    const transfer = await PlayerTransferModel.collection.insertOne({
      transferKey: "legacy-development-profile",
      transferDate: new Date("2026-08-21T00:00:00.000Z"),
      salePrice: 1_000_000,
      age: 20,
      skills: {},
      source: "test",
      developmentProfile: "central_midfielder"
    });

    const result = await migrateDevelopmentProfileKeys();
    const migratedTarget = await getPlayerDevelopmentTargetModel().collection.findOne({
      _id: developmentTarget.insertedId
    });
    const migratedTransfer = await PlayerTransferModel.collection.findOne({
      _id: transfer.insertedId
    });

    expect(result).toEqual({ developmentTargets: 1, playerTransfers: 1 });
    expect(migratedTarget?.profile).toBe("defender");
    expect(migratedTransfer?.developmentProfile).toBe("midfielder");
  });

  it("updates manual club configuration without changing observed Sokker data", async () => {
    const club = await clubs.save({
      clubId: 1,
      country: 1,
      name: "River Plate Forever",
      week: 4,
      training: { GK: 2, DEF: 6, MID: 4, ATT: 7 },
      currency: "ARS"
    });

    const updated = await clubs.updateManualProfile({
      clubId: club.id,
      assumptions: [{ key: "market-risk", value: "Keep liquidity buffer before buying." }],
      preferences: [{ key: "training-focus", value: "Prioritize playmaking trainees." }]
    });

    expect(updated).toMatchObject({
      clubId: 1,
      name: "River Plate Forever",
      week: 4
    });
    expect(updated.settings).toMatchObject({
      week: null
    });
    expect(updated.settings.assumptions[0]).toMatchObject({
      key: "market-risk",
      value: "Keep liquidity buffer before buying."
    });
  });

  it("retrieves a snapshot by id", async () => {
    const club = await clubs.save({
      clubId: 1,
      country: 1,
      name: "River Plate Forever",
      training: { GK: 2, DEF: 6, MID: 4, ATT: 7 },
      currency: "ARS"
    });
    const player = await players.resolveHistoricalIdentity({
      playerId: 1001,
      clubId: club.clubId,
      name: "Tomas Alvarez"
    });
    const saved = await snapshots.save(
      buildSnapshotInput({ clubId: club.clubId, playerId: player.playerId })
    );

    const found = await snapshots.findById(saved.id);

    expect(found?.id).toBe(saved.id);
    expect(found?.snapshotDate.toISOString()).toBe("2026-08-05T00:00:00.000Z");
  });

  it("lists snapshots for a club", async () => {
    const club = await clubs.save({
      clubId: 1,
      country: 1,
      name: "River Plate Forever",
      training: { GK: 2, DEF: 6, MID: 4, ATT: 7 },
      currency: "ARS"
    });
    const otherClub = await clubs.save({
      clubId: 2,
      country: 1,
      name: "Atlas Wanderers",
      training: { GK: 2, DEF: 6, MID: 4, ATT: 7 },
      currency: "ARS"
    });
    const player = await players.resolveHistoricalIdentity({
      playerId: 1001,
      clubId: club.clubId,
      name: "Tomas Alvarez"
    });

    await snapshots.save(
      buildSnapshotInput({
        clubId: club.clubId,
        playerId: player.playerId,
        snapshotDate: new Date("2026-08-06T00:00:00.000Z")
      })
    );
    await snapshots.save(buildSnapshotInput({ clubId: club.clubId, playerId: player.playerId }));
    await snapshots.save(
      buildSnapshotInput({ clubId: otherClub.clubId, playerId: player.playerId })
    );

    const list = await snapshots.listByClub(club.clubId);

    expect(list.map((snapshot) => snapshot.clubId)).toEqual([club.clubId, club.clubId]);
    expect(list.map((snapshot) => snapshot.snapshotDate.toISOString())).toEqual([
      "2026-08-05T00:00:00.000Z",
      "2026-08-06T00:00:00.000Z"
    ]);
  });

  it("retrieves snapshots by club and date", async () => {
    const club = await clubs.save({
      clubId: 1,
      country: 1,
      name: "River Plate Forever",
      training: { GK: 2, DEF: 6, MID: 4, ATT: 7 },
      currency: "ARS"
    });
    const player = await players.resolveHistoricalIdentity({
      playerId: 1001,
      clubId: club.clubId,
      name: "Tomas Alvarez"
    });
    const snapshotDate = new Date("2026-08-05T00:00:00.000Z");

    const saved = await snapshots.save(
      buildSnapshotInput({ clubId: club.clubId, playerId: player.playerId, snapshotDate })
    );

    const found = await snapshots.findByClubAndDate(club.clubId, snapshotDate);

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

  it("keeps manual development overrides separate from Sokker player sync", async () => {
    const saved = await developmentTargets.saveManualOverride({
      clubId: 1,
      playerId: 1001,
      profile: "forward",
      targetLevels: { striker: 15 },
      targetAge: 24
    });

    await players.resolveHistoricalIdentity({
      playerId: 1001,
      clubId: 1,
      name: "Updated Tomas",
      position: "MID",
      skills: { striker: 12 }
    });

    const override = await developmentTargets.findByPlayerId({ clubId: 1, playerId: 1001 });

    expect(saved).toMatchObject({ profile: "forward", targetAge: 24 });
    expect(override).toMatchObject({ profile: "forward", targetAge: 24 });
    expect(override?.targetLevels).toEqual({ striker: 15 });
  });

  it("keeps a manual squad role override when Sokker player state is synced", async () => {
    const saved = await squadRoleAssignments.saveManualOverride({
      clubId: 1,
      playerId: 1001,
      role: "core"
    });

    await players.resolveHistoricalIdentity({
      playerId: 1001,
      clubId: 1,
      name: "Updated Tomas",
      age: 29,
      skills: { defender: 14 }
    });

    const override = await squadRoleAssignments.findByPlayerId({ clubId: 1, playerId: 1001 });
    const raw = await getSquadRoleAssignmentModel().findOne({ clubId: 1, playerId: 1001 }).lean();

    expect(saved).toMatchObject({ role: "core", source: "manual" });
    expect(override).toMatchObject({ role: "core", source: "manual" });
    expect(raw).not.toHaveProperty("currentContributionScore");
    expect(raw).not.toHaveProperty("lifecycle");
  });
});

function buildSnapshotInput(overrides: {
  clubId: number;
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
        }
      }
    ],
    juniors: [
      {
        playerId: 5001,
        name: "Matias Cantero",
        age: 16,
        initialLevel: 8,
        weeksRemaining: 4,
        skill: 8,
        status: "in_academy"
      }
    ]
  };
}
