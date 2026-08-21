import currentFixture from "../../test-fixtures/fixtures/sokker-json-api/current.fixture.json" with { type: "json" };
import juniorsFixture from "../../test-fixtures/fixtures/sokker-json-api/juniors.fixture.json" with { type: "json" };
import summaryFixture from "../../test-fixtures/fixtures/sokker-json-api/training-summary.fixture.json" with { type: "json" };
import trainersFixture from "../../test-fixtures/fixtures/sokker-json-api/trainers.fixture.json" with { type: "json" };
import trainingFixture from "../../test-fixtures/fixtures/sokker-json-api/training.fixture.json" with { type: "json" };
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { SnapshotModel, SyncRunModel, TrainingWeekModel } from "@atlas/database";
import {
  MongoClubRepository,
  MongoPlayerRepository,
  MongoSnapshotRepository,
  MongoSyncRunRepository,
  MongoTrainingWeekRepository
} from "@atlas/database";
import {
  SokkerSyncPersistence,
  getTrainingPageData,
  loadSokkerSyncPayload,
  mapCurrentApiToCurrentClubContext,
  mapJuniorsApiToJuniors,
  mapTrainersApiToTrainers,
  mapTrainingApiToTrainingData,
  mapTrainingSummaryApiToTrainingSummary,
  type SokkerDataProvider,
  type SokkerSyncPayload,
  type ValidatedSokkerSyncPayload,
  validateSokkerSyncPayload
} from "@atlas/application";
import type {
  SokkerApiCurrentDto,
  SokkerJuniorsApiDto,
  SokkerTrainersApiDto,
  SokkerTrainingApiDto,
  SokkerTrainingSummaryApiDto
} from "../src/importer/providers/api/dtos.js";

let mongo: MongoMemoryServer;

describe("Sokker sync end-to-end", () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it("loads, validates and persists the real fixture shape end to end", async () => {
    const provider = createFixtureProvider();
    const payload = await loadSokkerSyncPayload(provider);

    expect(provider.getCurrent).toHaveBeenCalledOnce();
    expect(provider.getTraining).toHaveBeenCalledOnce();
    expect(provider.getTrainers).toHaveBeenCalledOnce();
    expect(provider.getJuniors).toHaveBeenCalledOnce();
    expect(provider.getTrainingSummary).toHaveBeenCalledOnce();
    expect(payload.players).toHaveLength(payload.trainingWeeks.length);

    const validation = validateSokkerSyncPayload(payload);
    expect(validation.status).toBe("valid");
    if (validation.status === "invalid") {
      throw new Error(validation.errors.map((error) => error.message).join("; "));
    }

    const result = await new SokkerSyncPersistence().persist(validation);

    await expect(getTrainingPageData(result.clubId)).resolves.toMatchObject({
      players: expect.arrayContaining([expect.objectContaining({ playerId: 40098056 })]),
      history: expect.any(Array)
    });

    expect(result.teamId).toBe(6038);
    expect(result.gameWeek).toBe(1205);
    expect(result.upserted).toMatchObject({
      players: 3,
      trainingWeeks: 3,
      trainers: 3,
      juniors: 2,
      trainingSummaryWeeks: 0
    });
    expect(await SnapshotModel.exists({ gameWeek: 1205 })).toBeTruthy();
    expect(await TrainingWeekModel.exists({ clubId: 6038, gameWeek: 1204 })).toBeTruthy();
    expect(await TrainingWeekModel.exists({ clubId: 6038, gameWeek: 1205 })).toBeFalsy();

    const training = await TrainingWeekModel.findOne({
      clubId: 6038,
      playerId: 40098056,
      gameWeek: 1204
    }).lean();
    expect(training).toMatchObject({
      type: "pace",
      kind: "advanced",
      intensity: 0,
      skillsChange: { pace: 1, passing: -1, up: 1, down: 1 }
    });

    const injuredSnapshot = await SnapshotModel.findOne({ gameWeek: 1205 }).lean();
    expect(injuredSnapshot?.players.find((player) => player.playerId === 39409355)).toMatchObject({
      availabilityStatus: "injured"
    });
  });

  it("repeats the same sync without duplicating facts and keeps current/training weeks separate", async () => {
    const payload = await loadSokkerSyncPayload(createFixtureProvider());
    const validation = toValidatedPayload(payload);
    const persistence = new SokkerSyncPersistence();

    await persistence.persist(validation);
    await persistence.persist(validation);

    expect(await SnapshotModel.countDocuments({ gameWeek: 1205 })).toBe(1);
    expect(await TrainingWeekModel.countDocuments({ clubId: 6038, gameWeek: 1204 })).toBe(3);
    expect(await TrainingWeekModel.countDocuments({ clubId: 6038, gameWeek: 1205 })).toBe(0);
  });

  it("aborts before persistence when the summary checksum is incompatible", async () => {
    const payload = await loadSokkerSyncPayload(createFixtureProvider());
    const reportWeek = payload.trainingWeeks[0]!.gameWeek;
    const summaryWeek = payload.trainingSummary.weeks.find((week) => week.gameWeek === reportWeek);
    if (!summaryWeek) {
      throw new Error(`Missing test summary week ${reportWeek}.`);
    }
    summaryWeek.players.advancedTraining += 1;

    const validation = validateSokkerSyncPayload(payload);

    expect(validation.status).toBe("invalid");
    if (validation.status === "valid") {
      throw new Error("The intentionally incompatible summary should be rejected.");
    }
    expect(validation.errors.map((error) => error.code)).toContain("SUMMARY_ADVANCED_MISMATCH");
    expect(await SnapshotModel.countDocuments({})).toBe(0);
    expect(await TrainingWeekModel.countDocuments({})).toBe(0);
  });

  it("updates a corrected training fact at the same natural key", async () => {
    const payload = await loadSokkerSyncPayload(createFixtureProvider());
    const persistence = new SokkerSyncPersistence();
    const validation = toValidatedPayload(payload);

    await persistence.persist(validation);
    payload.trainingWeeks[0]!.intensity = 100;
    const corrected = toValidatedPayload(payload);
    await persistence.persist(corrected);

    const training = await TrainingWeekModel.findOne({
      clubId: 6038,
      playerId: 40098056,
      gameWeek: 1204
    }).lean();
    expect(training?.intensity).toBe(100);
    expect(await TrainingWeekModel.countDocuments({ clubId: 6038, playerId: 40098056 })).toBe(1);
  });

  it("does not report success after an intermediate persistence failure", async () => {
    const payload = await loadSokkerSyncPayload(createFixtureProvider());
    const trainingWeeks = new MongoTrainingWeekRepository();
    vi.spyOn(trainingWeeks, "save").mockRejectedValueOnce(new Error("temporary write failure"));
    const persistence = new SokkerSyncPersistence({
      clubs: new MongoClubRepository(),
      players: new MongoPlayerRepository(),
      snapshots: new MongoSnapshotRepository(),
      syncRuns: new MongoSyncRunRepository(),
      trainingWeeks
    });

    await expect(persistence.persist(toValidatedPayload(payload))).rejects.toThrow(
      "Failed to persist Sokker sync"
    );
    expect(await SyncRunModel.countDocuments({ teamId: 6038, status: "failed" })).toBe(1);
    expect(await SyncRunModel.countDocuments({ teamId: 6038, status: "completed" })).toBe(0);
  });
});

function createFixtureProvider(): SokkerDataProvider {
  const current = mapCurrentApiToCurrentClubContext(currentFixture as SokkerApiCurrentDto);
  const training = mapTrainingApiToTrainingData((trainingFixture as SokkerTrainingApiDto).players);
  const trainers = mapTrainersApiToTrainers((trainersFixture as SokkerTrainersApiDto).trainers);
  const juniors = mapJuniorsApiToJuniors((juniorsFixture as SokkerJuniorsApiDto).juniors);
  const summary = mapTrainingSummaryApiToTrainingSummary(
    summaryFixture as SokkerTrainingSummaryApiDto
  );
  const reportWeek = training.trainingWeeks[0]!;
  const reportSummary = {
    gameWeek: reportWeek.gameWeek,
    season: reportWeek.season,
    seasonWeek: reportWeek.seasonWeek,
    date: reportWeek.date,
    players: {
      formationTraining: training.trainingWeeks.filter((week) => week.kind === "formation").length,
      advancedTraining: training.trainingWeeks.filter((week) => week.kind === "advanced").length,
      skillsUp: training.trainingWeeks.reduce((total, week) => total + week.skillsChange.up, 0)
    },
    juniors: { count: 999, skillsUp: 999 }
  };
  const payload: SokkerSyncPayload = {
    current: { ...current, calendar: { ...current.calendar, date: "2026-08-18" } },
    players: training.players,
    trainingWeeks: training.trainingWeeks,
    trainers,
    juniors,
    trainingSummary: { weeks: [reportSummary, ...summary.weeks] }
  };

  return {
    getCurrent: vi.fn(async () => payload.current),
    getTraining: vi.fn(async () => ({
      players: payload.players,
      trainingWeeks: payload.trainingWeeks
    })),
    getTrainers: vi.fn(async () => payload.trainers),
    getJuniors: vi.fn(async () => payload.juniors),
    getTrainingSummary: vi.fn(async () => payload.trainingSummary)
  };
}

function toValidatedPayload(payload: SokkerSyncPayload): ValidatedSokkerSyncPayload {
  const result = validateSokkerSyncPayload(payload);
  if (result.status === "invalid") {
    throw new Error(result.errors.map((error) => error.message).join("; "));
  }
  return result;
}
