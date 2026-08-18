import currentFixture from "../../test-fixtures/fixtures/sokker-json-api/current.fixture.json" with { type: "json" };
import juniorsFixture from "../../test-fixtures/fixtures/sokker-json-api/juniors.fixture.json" with { type: "json" };
import summaryFixture from "../../test-fixtures/fixtures/sokker-json-api/training-summary.fixture.json" with { type: "json" };
import trainersFixture from "../../test-fixtures/fixtures/sokker-json-api/trainers.fixture.json" with { type: "json" };
import trainingFixture from "../../test-fixtures/fixtures/sokker-json-api/training.fixture.json" with { type: "json" };
import { afterEach, describe, expect, it, vi } from "vitest";

import { createSokkerDataProvider, SokkerJsonApiProvider } from "@atlas/application";
import {
  mapApiCurrentToClubProfile,
  mapApiCurrentToSokkerCurrentDto,
  mapApiJuniorToSokkerJuniorDto,
  mapApiTrainingPlayerToPlayerTrainingWeekDto,
  mapApiTrainingPlayerToSokkerPlayerDto
} from "../src/importer/providers/api/mappers.js";
import type {
  SokkerCurrentApiDto,
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

    expect(current.team.league).toBeNull();
    expect(training.players).toHaveLength(3);
    expect(trainers.trainers).toHaveLength(3);
    expect(juniors.juniors).toHaveLength(2);
    expect(summary.weeks[1]?.stats).toEqual({ general: 0, advanced: 0, skillsUp: 0 });
    expect(mockFetch.mock.calls.slice(1).map(([url]) => String(url))).toEqual([
      "https://sokker.org/api/current",
      "https://sokker.org/api/training",
      "https://sokker.org/api/trainer",
      "https://sokker.org/api/junior",
      "https://sokker.org/api/training/summary"
    ]);
  });
});

describe("Sokker JSON API contracts", () => {
  it("maps current club data and preserves nullable external fields", () => {
    const current = currentFixture as SokkerCurrentApiDto;

    expect(mapApiCurrentToSokkerCurrentDto(current)).toMatchObject({
      gameWeek: 1204,
      week: 7,
      season: 78,
      teamId: 6038
    });
    expect(mapApiCurrentToClubProfile(current)).toMatchObject({
      externalId: "6038",
      countryId: 32,
      money: { amount: 123456, currency: "ARS" }
    });
  });

  it("maps training player plus report without leaking previousValue or games", () => {
    const training = trainingFixture as SokkerTrainingApiDto;
    const [individual, formation, missing] = training.players;

    expect(individual).toBeDefined();
    expect(formation).toBeDefined();
    expect(missing).toBeDefined();

    const player = mapApiTrainingPlayerToSokkerPlayerDto(individual!);
    const report = mapApiTrainingPlayerToPlayerTrainingWeekDto(individual!);
    const formationReport = mapApiTrainingPlayerToPlayerTrainingWeekDto(formation!);
    const missingReport = mapApiTrainingPlayerToPlayerTrainingWeekDto(missing!);

    expect(player).toMatchObject({
      playerId: 40098056,
      name: "Ada Lovelace",
      form: 10,
      training: { position: 0, advanced: true },
      skills: { defender: 5, playmaker: 9 }
    });
    expect(player).not.toHaveProperty("previousValue");
    expect(report).toMatchObject({
      intensity: 0,
      kind: "advanced",
      skillsChange: { pace: 1, passing: -1, down: 1, up: 1 }
    });
    expect(report).not.toHaveProperty("games");
    expect(formationReport.kind).toBe("formation");
    expect(missingReport.kind).toBe("missing");
    expect(individual?.report.formation).toBeNull();
  });

  it("consumes trainer info as the canonical source and preserves skill effectiveness", () => {
    const trainers = trainersFixture as SokkerTrainersApiDto;
    const first = trainers.trainers[0]!;

    expect(first.info.assignment.name).toBe("first");
    expect(first.info.skills.pace).toEqual({ value: 16, percent: 94 });
    expect(first.info.skills.averagePercent).toBe(77);
    expect(first.fullName?.full).toBe("ignored");
  });

  it("maps the junior wrapper without assuming pagination or ranges", () => {
    const juniors = juniorsFixture as SokkerJuniorsApiDto;

    expect(juniors.juniors.map(mapApiJuniorToSokkerJuniorDto)).toMatchObject([
      { playerId: 501, weeksRemaining: 8 },
      { playerId: 502, weeksRemaining: 0 }
    ]);
  });

  it("preserves summary aggregates, including zero current or future weeks", () => {
    const summary = summaryFixture as SokkerTrainingSummaryApiDto;

    expect(summary.weeks[0]?.stats.general).toBe(12);
    expect(summary.weeks[1]?.stats).toEqual({ general: 0, advanced: 0, skillsUp: 0 });
    expect(summary.weeks[1]?.juniors).toEqual({ number: 0, skillsUp: 0 });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
