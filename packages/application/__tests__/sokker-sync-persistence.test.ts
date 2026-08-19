import currentFixture from "../../test-fixtures/fixtures/sokker-json-api/current.fixture.json" with { type: "json" };
import juniorsFixture from "../../test-fixtures/fixtures/sokker-json-api/juniors.fixture.json" with { type: "json" };
import trainersFixture from "../../test-fixtures/fixtures/sokker-json-api/trainers.fixture.json" with { type: "json" };
import trainingFixture from "../../test-fixtures/fixtures/sokker-json-api/training.fixture.json" with { type: "json" };
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ClubModel,
  ImportEventModel,
  MongoClubRepository,
  MongoPlayerRepository,
  MongoSnapshotRepository,
  MongoSyncRunRepository,
  MongoTrainingWeekRepository,
  PlayerModel,
  SnapshotModel,
  SyncRunModel,
  TrainingWeekModel
} from "@atlas/database";
import {
  mapCurrentApiToCurrentClubContext,
  mapJuniorsApiToJuniors,
  mapTrainersApiToTrainers,
  mapTrainingApiToTrainingData,
  SokkerSyncPersistence,
  type SokkerSyncPayload,
  type ValidatedSokkerSyncPayload,
  validateSokkerSyncPayload
} from "@atlas/application";
import type {
  SokkerApiCurrentDto,
  SokkerJuniorsApiDto,
  SokkerTrainersApiDto,
  SokkerTrainingApiDto
} from "../src/importer/providers/api/dtos.js";

let mongo: MongoMemoryServer;

describe("SokkerSyncPersistence", () => {
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
      SyncRunModel.deleteMany({}),
      TrainingWeekModel.deleteMany({})
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it("upserts an identical sync without duplicating facts or current state", async () => {
    const payload = createPayload();
    const persistence = new SokkerSyncPersistence();

    const first = await persistence.persist(toValidatedPayload(payload));
    const second = await persistence.persist(toValidatedPayload(payload));

    expect(first.usedTransaction).toBe(false);
    expect(second.usedTransaction).toBe(false);
    expect(await SnapshotModel.countDocuments({ naturalKey: "sokker-json-api-sync" })).toBe(1);
    expect(await TrainingWeekModel.countDocuments({ clubId: 6038 })).toBe(3);
    expect(await SyncRunModel.countDocuments({ teamId: 6038, status: "completed" })).toBe(2);

    const snapshot = await SnapshotModel.findOne({ naturalKey: "sokker-json-api-sync" }).lean();
    const club = await ClubModel.findOne({ clubId: 6038 }).lean();
    expect(club?.budget).toBe(123456);
    expect(club).not.toHaveProperty("budget.value");
    expect(club?.currency).toBe("ARS");
    expect(club).not.toHaveProperty("settings.currency");
    expect(club?.training).toEqual({ GK: 2, DEF: 6, MID: 8, ATT: 7 });
    expect(club?.staff).toHaveLength(3);
    expect(snapshot?.juniors).toHaveLength(2);
    const training = await TrainingWeekModel.findOne({ playerId: 40098056 }).lean();
    expect(snapshot?.gameWeek).toBe(1205);
    expect(training?.gameWeek).toBe(1204);
    expect(second.snapshotId).toBe(first.snapshotId);
  });

  it("replaces a corrected TrainingHistory fact at the same natural key", async () => {
    const payload = createPayload();
    const persistence = new SokkerSyncPersistence();

    await persistence.persist(toValidatedPayload(payload));
    payload.trainingWeeks[0]!.intensity = 100;
    await persistence.persist(toValidatedPayload(payload));

    expect(
      await TrainingWeekModel.countDocuments({ clubId: 6038, playerId: 40098056, gameWeek: 1204 })
    ).toBe(1);
    expect(
      (await TrainingWeekModel.findOne({ clubId: 6038, playerId: 40098056, gameWeek: 1204 }).lean())
        ?.intensity
    ).toBe(100);
  });

  it("keeps prior history when a later current/training week is persisted", async () => {
    const firstPayload = createPayload();
    const secondPayload = createPayloadForNextWeek(firstPayload);
    const persistence = new SokkerSyncPersistence();

    await persistence.persist(toValidatedPayload(firstPayload));
    await persistence.persist(toValidatedPayload(secondPayload));

    expect(await SnapshotModel.countDocuments({ naturalKey: "sokker-json-api-sync" })).toBe(2);
    expect(await TrainingWeekModel.countDocuments({ clubId: 6038 })).toBe(6);
    expect(
      await SnapshotModel.exists({ naturalKey: "sokker-json-api-sync", gameWeek: 1205 })
    ).toBeTruthy();
    expect(
      await SnapshotModel.exists({ naturalKey: "sokker-json-api-sync", gameWeek: 1206 })
    ).toBeTruthy();
    expect(await TrainingWeekModel.exists({ clubId: 6038, gameWeek: 1204 })).toBeTruthy();
    expect(await TrainingWeekModel.exists({ clubId: 6038, gameWeek: 1205 })).toBeTruthy();
  });

  it("replaces embedded staff and youth current state", async () => {
    const firstPayload = createPayload();
    const secondPayload = structuredClone(firstPayload);
    secondPayload.trainers = secondPayload.trainers.slice(1);
    secondPayload.juniors = secondPayload.juniors.slice(1);
    const persistence = new SokkerSyncPersistence();

    await persistence.persist(toValidatedPayload(firstPayload));
    await persistence.persist(toValidatedPayload(secondPayload));

    expect((await ClubModel.findOne({ clubId: 6038 }).lean())?.staff).toHaveLength(2);
    expect(
      (await SnapshotModel.findOne({ naturalKey: "sokker-json-api-sync" }).lean())?.juniors
    ).toHaveLength(1);
  });
  it("marks a partial fallback run failed and safely completes on retry", async () => {
    const payload = createPayload();
    const trainingWeeks = new MongoTrainingWeekRepository();
    const saveTrainingWeek = vi
      .spyOn(trainingWeeks, "save")
      .mockRejectedValueOnce(new Error("temporary training write failure"));
    const persistence = new SokkerSyncPersistence({
      clubs: new MongoClubRepository(),
      players: new MongoPlayerRepository(),
      snapshots: new MongoSnapshotRepository(),
      syncRuns: new MongoSyncRunRepository(),
      trainingWeeks
    });

    await expect(persistence.persist(toValidatedPayload(payload))).rejects.toThrow(
      "Failed to upsert PlayerTraining naturalKey=40098056/1204"
    );
    await persistence.persist(toValidatedPayload(payload));

    expect(saveTrainingWeek).toHaveBeenCalledTimes(4);
    expect(await TrainingWeekModel.countDocuments({ clubId: 6038 })).toBe(3);
    expect(await SyncRunModel.countDocuments({ teamId: 6038, status: "failed" })).toBe(1);
    expect(await SyncRunModel.countDocuments({ teamId: 6038, status: "completed" })).toBe(1);
  });
});

function createPayload(): SokkerSyncPayload {
  const current = mapCurrentApiToCurrentClubContext(currentFixture as SokkerApiCurrentDto);
  const training = mapTrainingApiToTrainingData((trainingFixture as SokkerTrainingApiDto).players);
  const trainers = mapTrainersApiToTrainers((trainersFixture as SokkerTrainersApiDto).trainers);
  const juniors = mapJuniorsApiToJuniors((juniorsFixture as SokkerJuniorsApiDto).juniors);
  const reportWeek = training.trainingWeeks[0]!;
  const advancedTraining = training.trainingWeeks.filter((week) => week.kind === "advanced").length;
  const formationTraining = training.trainingWeeks.filter(
    (week) => week.kind === "formation"
  ).length;
  const skillsUp = training.trainingWeeks.reduce((total, week) => total + week.skillsChange.up, 0);

  return {
    current: { ...current, calendar: { ...current.calendar, date: "2026-08-18" } },
    players: training.players,
    trainingWeeks: training.trainingWeeks,
    trainers,
    juniors,
    trainingSummary: {
      weeks: [
        {
          gameWeek: reportWeek.gameWeek,
          season: reportWeek.season,
          seasonWeek: reportWeek.seasonWeek,
          date: reportWeek.date,
          players: { formationTraining, advancedTraining, skillsUp },
          juniors: { count: 999, skillsUp: 999 }
        },
        {
          gameWeek: current.calendar.gameWeek,
          season: current.calendar.season,
          seasonWeek: current.calendar.seasonWeek,
          date: "2026-08-20",
          players: { formationTraining: 0, advancedTraining: 0, skillsUp: 0 },
          juniors: { count: 0, skillsUp: 0 }
        }
      ]
    }
  };
}

function createPayloadForNextWeek(payload: SokkerSyncPayload): SokkerSyncPayload {
  const next = structuredClone(payload);
  next.current.calendar = {
    season: 78,
    gameWeek: 1206,
    seasonWeek: 9,
    date: "2026-08-27"
  };
  next.trainingWeeks.forEach((week) => {
    week.gameWeek = 1205;
    week.seasonWeek = 8;
    week.date = "2026-08-20";
  });
  next.trainingSummary.weeks[0]!.gameWeek = 1205;
  next.trainingSummary.weeks[0]!.seasonWeek = 8;
  next.trainingSummary.weeks[0]!.date = "2026-08-20";
  next.trainingSummary.weeks[1]!.gameWeek = 1206;
  next.trainingSummary.weeks[1]!.seasonWeek = 9;
  next.trainingSummary.weeks[1]!.date = "2026-08-27";
  return next;
}

function toValidatedPayload(payload: SokkerSyncPayload): ValidatedSokkerSyncPayload {
  const result = validateSokkerSyncPayload(payload);
  if (result.status === "invalid") {
    throw new Error(result.errors.map((error) => error.message).join("; "));
  }
  return result;
}
