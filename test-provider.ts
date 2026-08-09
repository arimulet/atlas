import { SokkerXmlProvider } from "./packages/application/src/sokker/sokker-xml-provider.js";
import { playerSnapshotV0Schema } from "./packages/contracts/src/playerSnapshot/schemas.js";
import { youthAcademySnapshotV0Schema } from "./packages/contracts/src/youthAcademySnapshot/schemas.js";

// Mock fetch
const globalFetch = global.fetch;
global.fetch = async (url, options) => {
  if (url === "https://sokker.org/start.php?session=xml") {
    return {
      text: async () => "OK teamID=1234",
      headers: new Headers({ "set-cookie": "XMLSESSID=fake_cookie;" })
    } as any;
  }
  if (url.includes("team-1234.xml")) {
    return {
      ok: true,
      text: async () => `<team><teamID>1234</teamID><name>FC Fake</name><countryID>1</countryID><money> 1000000 </money></team>`
    } as any;
  }
  if (url.includes("countries.xml")) {
    return {
      ok: true,
      text: async () => `<countries><country><countryID>1</countryID><name>Polska</name><currencyName>PLN</currencyName><currencyRate>1.0</currencyRate></country></countries>`
    } as any;
  }
  if (url.includes("players-1234.xml")) {
    return {
      ok: true,
      text: async () => `<players><player><playerID>1</playerID><name>Jan</name><surname>Kowalski</surname><age>20</age><value>2 000 000</value><wage>10 000</wage><form>10</form></player></players>`
    } as any;
  }
  if (url.includes("juniors.xml")) {
    return {
      ok: true,
      text: async () => `<juniors><junior><juniorID>1</juniorID><name>Piotr</name><age>16</age><weeks>5</weeks><skill>1</skill></junior></juniors>`
    } as any;
  }
  return { ok: false, text: async () => "" } as any;
};

async function test() {
  const provider = new SokkerXmlProvider();
  try {
    const data = await provider.importFullTeamData({ login: "fake", password: "fake" });
    
    const playerSnapshotPayload = {
      schemaVersion: "atlas.player-snapshot.v0",
      source: {
        type: "sokker-xml-import",
        exportedAt: data.importedAt.toISOString(),
        locale: null
      },
      club: {
        externalId: data.clubProfile.externalId,
        name: data.clubProfile.name
      },
      snapshot: {
        snapshotDate: data.importedAt.toISOString().split("T")[0],
        season: data.clubProfile.season,
        week: data.clubProfile.week
      },
      players: data.players
    };
    
    playerSnapshotV0Schema.parse(playerSnapshotPayload);
    youthAcademySnapshotV0Schema.parse(data.juniors);
    console.log("Success!");
  } catch (e: any) {
    console.error(e.message);
    if (e.issues) console.error(JSON.stringify(e.issues, null, 2));
  }
}

test();
