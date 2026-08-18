import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSokkerDataProvider,
  SokkerJsonApiProvider
} from "@atlas/application";

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
          JSON.stringify([
            {
              playerId: 1,
              name: "Ada Lovelace",
              age: 22,
              wage: 100,
              value: 1000,
              training: { position: 2, advanced: false },
              skills: { pace: 10 }
            }
          ])
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
      new URL(`https://sokker.org/api/teams/${TEAM_ID}/players`),
      { method: "GET", headers: { Cookie: "PHPSESSID=session" } }
    );
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
