import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSokkerDataProvider,
  SokkerJsonApiProvider,
  SokkerXmlProvider
} from "@atlas/application";

const TEAM_ID = 6038;

describe("createSokkerDataProvider", () => {
  it("creates the selected provider with the supplied credentials", () => {
    const xmlProvider = createSokkerDataProvider({
      source: "xml",
      credentials: { login: "user", password: "password" }
    });
    const apiProvider = createSokkerDataProvider({
      source: "json-api",
      credentials: { login: "user", password: "password" }
    });

    expect(xmlProvider).toBeInstanceOf(SokkerXmlProvider);
    expect(apiProvider).toBeInstanceOf(SokkerJsonApiProvider);
  });
});

describe("SokkerXmlProvider", () => {
  it("maps XML resources to the same canonical data consumed by the importer", async () => {
    vi.stubGlobal("fetch", buildXmlFetch());
    const provider = new SokkerXmlProvider({ login: "user", password: "password" });
    const result = await provider.getFullTeamData();

    expect(result.players[0]).toMatchObject({
      playerId: 1,
      name: "Ada Lovelace",
      training: { position: 2, advanced: true }
    });
    expect(result.juniors[0]).toMatchObject({
      playerId: 2,
      name: "Grace Hopper",
      weeksRemaining: 5
    });
    expect(result.countries).toEqual([
      { id: 1, name: "Argentina", currencyName: "ARS", currencyRate: 1 }
    ]);
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

function buildXmlFetch() {
  const xmlByFilename: Record<string, string> = {
    "vars.xml": "<vars><week>1204</week><day>1</day></vars>",
    [`team-${TEAM_ID}.xml`]: `<teamdata><team><teamID>${TEAM_ID}</teamID><name>River Plate Forever</name><countryID>1</countryID><money>1000</money><trainingTypeGk>0</trainingTypeGk><trainingTypeDef>1</trainingTypeDef><trainingTypeMid>2</trainingTypeMid><trainingTypeAtt>3</trainingTypeAtt></team></teamdata>`,
    [`players-${TEAM_ID}.xml`]: `<players><player><ID>1</ID><name>Ada</name><surname>Lovelace</surname><age>22</age><value>1000</value><wage>100</wage><trainingPosition>2</trainingPosition><isInTrainingSlot>1</isInTrainingSlot><skillForm>10</skillForm><skillPace>10</skillPace></player></players>`,
    "juniors.xml":
      "<juniors><junior><ID>2</ID><name>Grace</name><surname>Hopper</surname><age>17</age><weeks>5</weeks><skill>6</skill></junior></juniors>",
    "countries.xml":
      "<countries><country><countryID>1</countryID><name>Argentina</name><currencyName>ARS</currencyName><currencyRate>1</currencyRate></country></countries>"
  };

  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes("start.php?session=xml")) {
      return new Response("OK teamID=6038", {
        headers: { "set-cookie": "XMLSESSID=session" }
      });
    }

    const filename = url.split("/").pop();
    const xml = filename ? xmlByFilename[filename] : undefined;

    if (!xml) {
      throw new Error(`Missing fixture ${filename}`);
    }

    return new Response(xml);
  });
}
