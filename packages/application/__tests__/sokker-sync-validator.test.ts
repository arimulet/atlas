import currentFixture from "../../test-fixtures/fixtures/sokker-json-api/current.fixture.json" with { type: "json" };
import juniorsFixture from "../../test-fixtures/fixtures/sokker-json-api/juniors.fixture.json" with { type: "json" };
import trainersFixture from "../../test-fixtures/fixtures/sokker-json-api/trainers.fixture.json" with { type: "json" };
import trainingFixture from "../../test-fixtures/fixtures/sokker-json-api/training.fixture.json" with { type: "json" };
import { describe, expect, it } from "vitest";

import type {
  SokkerApiCurrentDto,
  SokkerJuniorsApiDto,
  SokkerTrainersApiDto,
  SokkerTrainingApiDto
} from "../src/importer/providers/api/dtos.js";
import {
  mapCurrentApiToCurrentClubContext,
  mapJuniorsApiToJuniors,
  mapTrainersApiToTrainers,
  mapTrainingApiToTrainingData,
  type SokkerSyncPayload,
  validateSokkerSyncPayload
} from "@atlas/application";

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
    current: {
      ...current,
      calendar: { ...current.calendar, date: "2026-08-18" }
    },
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

function expectFatal(payload: SokkerSyncPayload, code: string): void {
  const result = validateSokkerSyncPayload(payload);

  expect(result.status).toBe("invalid");
  if (result.status === "invalid") {
    expect(result.errors.some((error) => error.code === code)).toBe(true);
  }
}

describe("SokkerSyncValidator", () => {
  it("accepts the normal current W1205 plus training W1204 payload", () => {
    const payload = createPayload();

    const result = validateSokkerSyncPayload(payload);

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.payload).toBe(payload);
      expect(result.warnings).toEqual([]);
    }
  });

  it("accepts the observed W1204 aggregate of 8 advanced, 13 formation and 4 missing reports", () => {
    const payload = createPayload();
    const playerTemplates = payload.players;
    const trainingTemplates = payload.trainingWeeks;

    payload.players = Array.from({ length: 25 }, (_, index) => {
      const player = structuredClone(playerTemplates[index % playerTemplates.length]!);
      player.id = 50000000 + index;
      return player;
    });
    payload.trainingWeeks = Array.from({ length: 25 }, (_, index) => {
      const trainingWeek = structuredClone(trainingTemplates[index % trainingTemplates.length]!);
      trainingWeek.playerId = payload.players[index]!.id;
      trainingWeek.kind = index < 8 ? "advanced" : index < 21 ? "formation" : "missing";
      trainingWeek.skillsChange = {
        ...trainingWeek.skillsChange,
        form: 0,
        tacticalDiscipline: 0,
        teamwork: 0,
        experience: 0,
        stamina: 0,
        keeper: 0,
        playmaking: 0,
        passing: 0,
        technique: 0,
        defending: 0,
        striker: 0,
        pace: index < 5 ? 1 : 0,
        up: index < 5 ? 1 : 0,
        down: 0
      };
      return trainingWeek;
    });
    payload.trainingSummary.weeks[0]!.players = {
      formationTraining: 13,
      advancedTraining: 8,
      skillsUp: 5
    };

    const result = validateSokkerSyncPayload(payload);

    expect(result.status).toBe("valid");
  });

  it("accepts formation null and intensity zero without warnings", () => {
    const payload = createPayload();

    const result = validateSokkerSyncPayload(payload);

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.warnings).toEqual([]);
    }
  });

  it("accepts a future summary week without treating it as completed training", () => {
    const payload = createPayload();
    payload.trainingSummary.weeks[1]!.date = "2026-08-20";
    payload.trainingSummary.weeks[1]!.players.skillsUp = 0;

    const result = validateSokkerSyncPayload(payload);

    expect(result.status).toBe("valid");
  });

  it("rejects a training week after the current game week", () => {
    const payload = createPayload();
    payload.trainingWeeks.forEach((week) => {
      week.gameWeek = 1206;
    });

    expectFatal(payload, "TRAINING_WEEK_IN_FUTURE");
  });

  it("rejects training reports from different weeks", () => {
    const payload = createPayload();
    payload.trainingWeeks[1]!.gameWeek = 1203;

    expectFatal(payload, "INCONSISTENT_TRAINING_WEEK");
  });

  it("rejects a player without a corresponding training report", () => {
    const payload = createPayload();
    payload.trainingWeeks.pop();

    expectFatal(payload, "MISSING_TRAINING_REPORT");
  });

  it("rejects a training report for an unknown player", () => {
    const payload = createPayload();
    payload.trainingWeeks[0]!.playerId = 99999999;

    expectFatal(payload, "MISSING_PLAYER_FOR_TRAINING");
  });

  it("rejects duplicate player IDs", () => {
    const payload = createPayload();
    payload.players[1]!.id = payload.players[0]!.id;

    expectFatal(payload, "DUPLICATE_PLAYER_ID");
  });

  it.each([
    [
      "player",
      "PLAYER_TEAM_ID_MISMATCH",
      (payload: SokkerSyncPayload): void => {
        payload.players[0]!.teamId = 1234;
      }
    ],
    [
      "trainer",
      "TRAINER_TEAM_ID_MISMATCH",
      (payload: SokkerSyncPayload): void => {
        payload.trainers[0]!.teamId = 1234;
      }
    ],
    [
      "junior",
      "JUNIOR_TEAM_ID_MISMATCH",
      (payload: SokkerSyncPayload): void => {
        payload.juniors[0]!.teamId = 1234;
      }
    ]
  ] as const)("rejects a team mismatch for a %s", (_resource, code, mutate) => {
    const payload = createPayload();
    mutate(payload);

    expectFatal(payload, code);
  });

  it("rejects duplicate trainer and junior IDs", () => {
    const trainerPayload = createPayload();
    trainerPayload.trainers[1]!.id = trainerPayload.trainers[0]!.id;
    expectFatal(trainerPayload, "DUPLICATE_TRAINER_ID");

    const juniorPayload = createPayload();
    juniorPayload.juniors[1]!.id = juniorPayload.juniors[0]!.id;
    expectFatal(juniorPayload, "DUPLICATE_JUNIOR_ID");
  });

  it("rejects advanced, formation and skills-up summary mismatches", () => {
    const advancedPayload = createPayload();
    advancedPayload.trainingSummary.weeks[0]!.players.advancedTraining = 0;
    expectFatal(advancedPayload, "SUMMARY_ADVANCED_MISMATCH");

    const formationPayload = createPayload();
    formationPayload.trainingSummary.weeks[0]!.players.formationTraining = 0;
    expectFatal(formationPayload, "SUMMARY_FORMATION_MISMATCH");

    const skillsUpPayload = createPayload();
    skillsUpPayload.trainingSummary.weeks[0]!.players.skillsUp = 0;
    expectFatal(skillsUpPayload, "SUMMARY_SKILL_UP_MISMATCH");
  });

  it("requires the historical report week in the summary but not the current week", () => {
    const payload = createPayload();
    payload.trainingSummary.weeks = [payload.trainingSummary.weeks[1]!];

    expectFatal(payload, "SUMMARY_WEEK_NOT_FOUND");
  });

  it("does not compare current juniors with historical summary juniors", () => {
    const payload = createPayload();
    payload.trainingSummary.weeks[0]!.juniors.count = 1;

    const result = validateSokkerSyncPayload(payload);

    expect(result.status).toBe("valid");
  });

  it("returns non-blocking warnings for an empty junior list and no head trainer", () => {
    const payload = createPayload();
    payload.juniors = [];
    payload.trainers = [];

    const result = validateSokkerSyncPayload(payload);

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.warnings.map((warning) => warning.code)).toEqual([
        "MISSING_HEAD_TRAINER",
        "EMPTY_JUNIOR_LIST"
      ]);
    }
  });

  it("keeps form and teamwork changes independent from core skill-up counters", () => {
    const payload = createPayload();
    payload.trainingWeeks[0]!.skillsChange.form = 2;
    payload.trainingWeeks[0]!.skillsChange.teamwork = 1;

    const result = validateSokkerSyncPayload(payload);

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.warnings).toEqual([]);
    }
  });

  it("rejects duplicate summary weeks and invalid intensity", () => {
    const duplicateSummaryPayload = createPayload();
    duplicateSummaryPayload.trainingSummary.weeks[1]!.gameWeek =
      duplicateSummaryPayload.trainingSummary.weeks[0]!.gameWeek;
    expectFatal(duplicateSummaryPayload, "DUPLICATE_SUMMARY_WEEK");

    const invalidIntensityPayload = createPayload();
    invalidIntensityPayload.trainingWeeks[0]!.intensity = 101;
    expectFatal(invalidIntensityPayload, "INVALID_TRAINING_INTENSITY");
  });
});
