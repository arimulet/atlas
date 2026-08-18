import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSokkerDataProvider,
  SokkerJsonApiProvider
} from "@atlas/application";
import {
  mapApiCurrentToSokkerCurrentDto,
  mapApiJuniorToSokkerJuniorDto,
  mapApiPlayerToSokkerPlayerDto,
  mapApiTeamToSokkerTeamDto
} from "../src/importer/providers/api/mappers.js";

const TEAM_ID = 6038;

describe("createSokkerDataProvider", () => {
  it("creates the JSON API provider with the supplied credentials", () => {
    const provider = createSokkerDataProvider({ login: "user", password: "password" });

    expect(provider).toBeInstanceOf(SokkerJsonApiProvider);
  });
});

describe("SokkerJsonApiProvider", () => {
  it("maps API DTOs before returning data to the importer", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { headers: { "set-cookie": "PHPSESSID=session" } }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                playerId: 1,
                name: "Ada Lovelace",
                age: 22,
                wage: 100,
                value: 1000,
                training: { position: 2, advanced: false },
                skills: { pace: 10 }
              }
            ]
          })
        )
      );
    vi.stubGlobal("fetch", mockFetch);
    const provider = new SokkerJsonApiProvider({ login: "user", password: "password" });

    const player = await provider.getPlayers(TEAM_ID);

    expect(player[0]).toMatchObject({
      playerId: 1,
      name: "Ada Lovelace",
      availabilityStatus: "available",
      skills: { pace: 10 }
    });
    expect(mockFetch).toHaveBeenNthCalledWith(1, "https://sokker.org/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: "user", password: "password", remember: false })
    });
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
        new URL(
          `https://sokker.org/api/player?filter%5Bteam%5D=${TEAM_ID}&filter%5Blimit%5D=200&filter%5Boffset%5D=0`
        ),
        { method: "GET", headers: { Cookie: "PHPSESSID=session" } }
      );
  });
});

describe("Sokker JSON current mapper", () => {
  it("maps junior ids and weeks from the JSON API names", () => {
    const junior = mapApiJuniorToSokkerJuniorDto({
      id: 42,
      name: "Grace Hopper",
      age: 16,
      weeks: 7,
      skill: 8
    });

    expect(junior).toMatchObject({
      playerId: 42,
      initialWeeksRemaining: 7,
      weeksRemaining: 7,
      skill: 8
    });
  });

  it("maps player skills when the API nests them under info", () => {
    const player = mapApiPlayerToSokkerPlayerDto({
      playerId: 1,
      name: "Ada Lovelace",
      age: 22,
      value: 1000,
      info: {
        salary: { amount: "100", currency: "USD" },
        skills: { stamina: 8, pace: 10 },
        formation: { position: 2, advanced: false }
      }
    });

    expect(player).toMatchObject({
      playerId: 1,
      skills: { stamina: 8, pace: 10 },
      training: { position: 2, advanced: false }
    });
  });

  it("accepts a team without training configuration", () => {
    const team = mapApiTeamToSokkerTeamDto({
      id: TEAM_ID,
      name: "River Plate Forever",
      countryId: 1,
      money: 1000
    });

    expect(team.training).toEqual({ gk: null, def: null, mid: null, att: null });
  });

  it("maps nested team country and money fields", () => {
    const team = mapApiTeamToSokkerTeamDto({
      id: TEAM_ID,
      name: "River Plate Forever",
      country: { id: 1 },
      money: { amount: 1000 },
      training: { goalkeeper: 5 }
    });

    expect(team).toMatchObject({
      countryId: 1,
      money: { amount: 1000 },
      training: { gk: 5 }
    });
  });

  it("uses the API week field as the absolute game week", () => {
    const current = mapApiCurrentToSokkerCurrentDto({
      week: 1204,
      season: 78,
      seasonWeek: 7,
      teamId: TEAM_ID
    });

    expect(current).toEqual({
      gameWeek: 1204,
      week: 7,
      season: 78,
      teamId: TEAM_ID
    });
  });

  it("derives the absolute game week when the API only provides season data", () => {
    const current = mapApiCurrentToSokkerCurrentDto({
      season: 78,
      seasonWeek: 7,
      teamId: TEAM_ID
    });

    expect(current.gameWeek).toBe(1204);
  });

  it("maps the nested current response returned by the JSON API", () => {
    const current = mapApiCurrentToSokkerCurrentDto({
      current: {
        calendar: { season: 78, seasonWeek: 7 },
        team: { id: TEAM_ID }
      }
    });

    expect(current).toMatchObject({
      gameWeek: 1204,
      week: 7,
      season: 78,
      teamId: TEAM_ID
    });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
