import { XMLParser } from "fast-xml-parser";
import {
  sokkerCountriesXmlSchema,
  sokkerJuniorsXmlSchema,
  sokkerPlayersXmlSchema,
  sokkerTeamXmlSchema,
  sokkerVarsXmlSchema
} from "@atlas/contracts";
import { normalizeSeasonWeek } from "@atlas/domain";

import type { PlayerSnapshotV0 } from "@atlas/contracts";
import type {
  ClubObservedProfile,
  CountryReference,
  SokkerAuthResult,
  SokkerCredentials,
  XmlImportResult
} from "./types.js";

export type {
  ClubObservedProfile,
  CountryReference,
  SokkerAuthResult,
  SokkerCredentials,
  XmlImportResult
} from "./types.js";

export { normalizeSeasonWeek } from "@atlas/domain";

const sessionCache = new Map<string, { sessionId: string; teamId: string; expiresAt: number }>();

export class SokkerXMLProvider {
  private readonly parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_"
    });
  }

  async login(credentials: SokkerCredentials): Promise<SokkerAuthResult> {
    const cached = sessionCache.get(credentials.login);
    if (cached && cached.expiresAt > Date.now()) {
      return { sessionId: cached.sessionId, teamId: cached.teamId };
    }

    const params = new URLSearchParams();
    params.append("ilogin", credentials.login);
    params.append("ipassword", credentials.password);

    const response = await fetch("https://sokker.org/start.php?session=xml", {
      method: "POST",
      body: params
    });

    const body = await response.text();

    if (!body.includes("OK")) {
      throw new Error(`Sokker authentication failed: ${body}`);
    }

    const teamIdMatch = body.match(/teamID=(\d+)/);
    if (!teamIdMatch) {
      throw new Error(`Could not parse Team ID from Sokker response: ${body}`);
    }

    const teamId = teamIdMatch[1]!;

    const setCookie = response.headers.get("set-cookie");
    let sessionId = "";
    if (setCookie) {
      const match = setCookie.match(/XMLSESSID=([^;]+)/);
      if (match) {
        sessionId = match[1]!;
      }
    }

    if (!sessionId) {
      throw new Error("No session cookie received from Sokker");
    }

    sessionCache.set(credentials.login, {
      sessionId,
      teamId,
      expiresAt: Date.now() + 1000 * 60 * 30
    });

    return { sessionId, teamId };
  }

  async fetchXml(filename: string, sessionId: string): Promise<string> {
    const response = await fetch(`https://sokker.org/xml/${filename}`, {
      headers: {
        Cookie: `XMLSESSID=${sessionId}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${filename}: ${response.statusText}`);
    }

    return response.text();
  }

  async importFullTeamData(credentials: SokkerCredentials): Promise<XmlImportResult> {
    const auth = await this.login(credentials);

    const [teamXmlRaw, countriesXmlRaw, playersXmlRaw, juniorsXmlRaw, varsXmlRaw] =
      await Promise.all([
        this.fetchXml(`team-${auth.teamId}.xml`, auth.sessionId),
        this.fetchXml("countries.xml", auth.sessionId),
        this.fetchXml(`players-${auth.teamId}.xml`, auth.sessionId),
        this.fetchXml("juniors.xml", auth.sessionId),
        this.fetchXml("vars.xml", auth.sessionId)
      ]);

    const teamJson = this.parser.parse(teamXmlRaw);
    const countriesJson = this.parser.parse(countriesXmlRaw);
    const playersJson = this.parser.parse(playersXmlRaw);
    const juniorsJson = this.parser.parse(juniorsXmlRaw);
    const varsJson = this.parser.parse(varsXmlRaw);

    let teamData, countriesData, playersData, juniorsData, varsData;
    try {
      teamData = sokkerTeamXmlSchema.parse(teamJson).teamdata.team;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const keys = teamJson.teamdata ? Object.keys(teamJson.teamdata) : Object.keys(teamJson);
      throw new Error(
        `Team validation failed. Received keys: ${JSON.stringify(keys)}. Error: ${message}`
      );
    }

    try {
      countriesData = sokkerCountriesXmlSchema.parse(countriesJson).countries.country;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Countries validation failed. Received keys: ${JSON.stringify(Object.keys(countriesJson))}. Error: ${message}`
      );
    }

    try {
      playersData = sokkerPlayersXmlSchema.parse(playersJson).players.player;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Players validation failed. Received keys: ${JSON.stringify(Object.keys(playersJson))}. Error: ${message}`
      );
    }

    try {
      juniorsData = sokkerJuniorsXmlSchema.parse(juniorsJson).juniors.junior;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Juniors validation failed. Received keys: ${JSON.stringify(Object.keys(juniorsJson))}. Error: ${message}`
      );
    }

    try {
      varsData = sokkerVarsXmlSchema.parse(varsJson).vars;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        "Vars validation failed. Received keys: " +
          JSON.stringify(Object.keys(varsJson)) +
          ". Error: " +
          message
      );
    }

    const countries: CountryReference[] = (
      Array.isArray(countriesData) ? countriesData : [countriesData]
    ).map((country) => ({
      id: country.countryID,
      name: country.name,
      currencyName: country.currencyName,
      currencyRate: country.currencyRate
    }));

    const convertMoney = (amount: number): ClubObservedProfile["money"] => ({
      amount,
      currency: null
    });

    const clubProfile: ClubObservedProfile = {
      externalId: String(teamData.teamID),
      name: teamData.name,
      countryId: teamData.countryID,
      money: convertMoney(teamData.money),
      season: teamData.season,
      gameWeek: varsData.week,
      week: normalizeSeasonWeek(varsData.week),
      training: {
        gk: teamData.trainingTypeGk ?? null,
        def: teamData.trainingTypeDef ?? null,
        mid: teamData.trainingTypeMid ?? null,
        att: teamData.trainingTypeAtt ?? null
      }
    };

    const playersArray = Array.isArray(playersData)
      ? playersData
      : playersData
        ? [playersData]
        : [];
    const players: PlayerSnapshotV0["players"] = playersArray.map((player) => {
      const name = player.surname ? `${player.name} ${player.surname}` : player.name;
      return {
        playerId: player.ID,
        name,
        age: player.age,
        wage: player.wage,
        value: player.value,
        training: {
          position: player.trainingPosition,
          advanced: player.isInTrainingSlot
        },
        form: player.skillForm ?? 10,
        availabilityStatus: "available",
        observedPosition: null,
        skills: {
          stamina: player.skillStamina,
          pace: player.skillPace,
          technique: player.skillTechnique,
          passing: player.skillPassing,
          keeper: player.skillKeeper,
          defender: player.skillDefending,
          playmaker: player.skillPlaymaking,
          striker: player.skillScoring
        }
      };
    });

    const juniorsArray = Array.isArray(juniorsData)
      ? juniorsData
      : juniorsData
        ? [juniorsData]
        : [];
    const juniors: NonNullable<PlayerSnapshotV0["juniors"]> = juniorsArray.map((junior) => {
      const name = junior.surname ? `${junior.name} ${junior.surname}` : junior.name;
      return {
        playerId: junior.ID,
        name,
        age: junior.age,
        initialWeeksRemaining: junior.weeks,
        weeksRemaining: junior.weeks,
        skill: junior.skill,
        status: "in_academy"
      };
    });

    return {
      clubProfile,
      players,
      juniors,
      source: "sokker-xml-import",
      importedAt: new Date(),
      countries
    };
  }
}
