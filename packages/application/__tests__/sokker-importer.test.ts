import currentFixture from "../../test-fixtures/fixtures/sokker-json-api/current.fixture.json" with { type: "json" };
import juniorsFixture from "../../test-fixtures/fixtures/sokker-json-api/juniors.fixture.json" with { type: "json" };
import summaryFixture from "../../test-fixtures/fixtures/sokker-json-api/training-summary.fixture.json" with { type: "json" };
import trainersFixture from "../../test-fixtures/fixtures/sokker-json-api/trainers.fixture.json" with { type: "json" };
import trainingFixture from "../../test-fixtures/fixtures/sokker-json-api/training.fixture.json" with { type: "json" };
import { afterEach, describe, expect, it, vi } from "vitest";

import { createSokkerDataProvider, SokkerJsonApiProvider } from "@atlas/application";
import {
  mapCurrentApiToCurrentClubContext,
  mapJuniorApiToJunior,
  mapTrainingApiToPlayers,
  mapTrainingApiToTrainingWeeks,
  mapTrainingKind,
  mapTrainingPlayerApiToPlayer,
  mapTrainingSummaryApiToTrainingSummary,
  mapTrainingType,
  mapTrainerApiToTrainer,
  mapTrainersApiToTrainers
} from "../src/importer/providers/api/mappers.js";
import type {
  SokkerApiCurrentDto,
  SokkerJuniorsApiDto,
  SokkerTrainersApiDto,
  SokkerTrainingApiDto,
  SokkerTrainingSummaryApiDto
} from "../src/importer/providers/api/dtos.js";

describe("createSokkerDataProvider", () => {
  it("creates the JSON API provider with the supplied credentials", () => {
    const provider = createSokkerDataProvider({ login: "user", password: "password" });

    expect(provider).toBeInstanceOf(SokkerJsonApiProvider);
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(provider))).toEqual(
      expect.arrayContaining([
        "getCurrent",
        "getTraining",
        "getTrainers",
        "getJuniors",
        "getTrainingSummary"
      ])
    );
  });
});

describe("SokkerJsonApiProvider", () => {
  it("reports authentication failures without propagating the response body", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("invalid credentials echoed by upstream", { status: 401 })
      );
    vi.stubGlobal("fetch", mockFetch);

    const provider = new SokkerJsonApiProvider({ login: "user", password: "password" });

    const error = await provider.login().catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Sokker API authentication failed (401).");
    expect((error as Error).message).not.toContain("invalid credentials echoed by upstream");
  });

  it("exposes only the five current JSON API resources", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { headers: { "set-cookie": "PHPSESSID=session" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(currentFixture)))
      .mockResolvedValueOnce(new Response(JSON.stringify(trainingFixture)))
      .mockResolvedValueOnce(new Response(JSON.stringify(trainersFixture)))
      .mockResolvedValueOnce(new Response(JSON.stringify(juniorsFixture)))
      .mockResolvedValueOnce(new Response(JSON.stringify(summaryFixture)));
    vi.stubGlobal("fetch", mockFetch);

    const provider = new SokkerJsonApiProvider({ login: "user", password: "password" });

    const current = await provider.getCurrent();
    const training = await provider.getTraining();
    const trainers = await provider.getTrainers();
    const juniors = await provider.getJuniors();
    const summary = await provider.getTrainingSummary();

    expect(current.calendar.gameWeek).toBe(1205);
    expect(training.players).toHaveLength(3);
    expect(trainers).toHaveLength(3);
    expect(juniors).toHaveLength(2);
    expect(summary.weeks[1]?.players).toEqual({
      formationTraining: 0,
      advancedTraining: 0,
      skillsUp: 0
    });
    expect(mockFetch.mock.calls.slice(1).map(([url]) => String(url))).toEqual([
      "https://sokker.org/api/current",
      "https://sokker.org/api/training",
      "https://sokker.org/api/trainer",
      "https://sokker.org/api/junior",
      "https://sokker.org/api/training/summary"
    ]);
  });
});

describe("Sokker API canonical mappers", () => {
  it("maps current into a minimal canonical club context", () => {
    const current = mapCurrentApiToCurrentClubContext(currentFixture as SokkerApiCurrentDto);

    expect(current).toEqual({
      userId: 91,
      userName: "Ada",
      team: {
        id: 6038,
        name: "River Plate Forever",
        rank: 3,
        rankPosition: 1,
        country: { code: 32, name: "Argentina" },
        bankrupt: false
      },
      budget: { value: 123456, currency: "ARS" },
      training: { GK: 2, DEF: 6, MID: 4, ATT: 7 },
      calendar: {
        season: 78,
        gameWeek: 1205,
        seasonWeek: 8,
        date: "2026-08-20"
      }
    });
    expect(current).not.toHaveProperty("plus");
    expect(current.team).not.toHaveProperty("emblem");
  });

  it("maps training player into a canonical player without external-only fields", () => {
    const training = trainingFixture as SokkerTrainingApiDto;
    const player = mapTrainingPlayerApiToPlayer(training.players[0]!);

    expect(player).toEqual({
      id: 40098056,
      teamId: 6038,
      name: { firstName: "Ada", lastName: "Lovelace", fullName: "Ada Lovelace" },
      country: { code: 32, name: "Argentina" },
      value: { value: 450000, currency: "ARS" },
      wage: { value: 12000, currency: "ARS" },
      age: 20,
      height: 180,
      weight: 75,
      bmi: 23.1,
      skills: expect.objectContaining({
        form: 10,
        tacticalDiscipline: 8,
        defending: 5,
        pace: 11
      }),
      formation: null,
      cards: { yellow: 0, red: 0 },
      injury: { daysRemaining: 0, severe: false },
      youthTeamId: 0,
      nationalCallUp: false,
      nationalType: "none"
    });
    expect(player).not.toHaveProperty("previousValue");
    expect(player).not.toHaveProperty("face");
    expect(player).not.toHaveProperty("stats");
    expect(player).not.toHaveProperty("nationalStats");
  });

  it("maps the full training collection into separate player and report outputs", () => {
    const training = trainingFixture as SokkerTrainingApiDto;
    const players = mapTrainingApiToPlayers(training.players);
    const reports = mapTrainingApiToTrainingWeeks(training.players);

    expect(players).toHaveLength(3);
    expect(reports).toHaveLength(3);
    expect(reports[0]).toMatchObject({
      playerId: 40098056,
      gameWeek: 1204,
      season: 78,
      seasonWeek: 7,
      date: "2026-08-12",
      trainedSkill: "pace",
      kind: "advanced",
      intensity: 0,
      formation: null,
      skillsChange: { pace: 1, passing: -1, up: 1, down: 1 }
    });
    expect(reports[0]).not.toHaveProperty("games");
    expect(reports[1]?.kind).toBe("formation");
    expect(reports[2]?.kind).toBe("missing");
  });

  it.each([
    [{ code: 1, name: "individual" }, "advanced"],
    [{ code: 2, name: "formation" }, "formation"],
    [{ code: 3, name: "missing" }, "missing"]
  ] as const)("maps training kind %o", (source, expected) => {
    expect(mapTrainingKind(source)).toBe(expected);
  });

  it.each([
    [{ code: 0, name: "general" }, "general"],
    [{ code: 2, name: "keeper" }, "keeper"],
    [{ code: 6, name: "defending" }, "defending"],
    [{ code: 8, name: "pace" }, "pace"]
  ] as const)("maps training type %o", (source, expected) => {
    expect(mapTrainingType(source)).toBe(expected);
  });

  it("rejects unknown training kind and type instead of silently defaulting", () => {
    expect(() => mapTrainingKind({ code: 99, name: "unknown" })).toThrow();
    expect(() => mapTrainingType({ code: 99, name: "unknown" })).toThrow();
  });

  it("maps trainer info only and preserves value, percent and average effectiveness", () => {
    const trainers = trainersFixture as SokkerTrainersApiDto;
    const first = mapTrainerApiToTrainer(trainers.trainers[0]!);
    const mapped = mapTrainersApiToTrainers(trainers.trainers);

    expect(first).toMatchObject({
      id: 1,
      teamId: 6038,
      name: { fullName: "Alan Turing" },
      assignment: "HEAD",
      salary: { value: 10000, currency: "ARS" },
      averageEffectivenessPercent: 77,
      skills: { pace: { level: 16, effectivenessPercent: 94 } }
    });
    expect(first.name.fullName).not.toBe("ignored");
    expect(mapped.map((trainer) => trainer.assignment)).toEqual(["HEAD", "ASSISTANT", "YOUTH"]);
  });

  it("maps juniors into a single canonical name and current level", () => {
    const juniors = juniorsFixture as SokkerJuniorsApiDto;
    const junior = mapJuniorApiToJunior(juniors.juniors[0]!);

    expect(junior).toEqual({
      id: 501,
      teamId: 6038,
      name: { firstName: "Junior", lastName: "One", fullName: "Junior One" },
      age: 16,
      currentLevel: 7,
      weeksLeft: 8
    });
    expect(junior).not.toHaveProperty("fullName");
  });

  it("maps training summary with explicit formation and advanced semantics", () => {
    const summary = mapTrainingSummaryApiToTrainingSummary(
      summaryFixture as SokkerTrainingSummaryApiDto
    );

    expect(summary.weeks[0]).toEqual({
      gameWeek: 1203,
      season: 78,
      seasonWeek: 6,
      date: "2026-08-05",
      players: { formationTraining: 12, advancedTraining: 8, skillsUp: 2 },
      juniors: { count: 4, skillsUp: 1 }
    });
    expect(summary.weeks[1]).toMatchObject({
      gameWeek: 1205,
      players: { formationTraining: 0, advancedTraining: 0, skillsUp: 0 }
    });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
