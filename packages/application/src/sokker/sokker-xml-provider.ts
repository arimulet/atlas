import { XMLParser } from "fast-xml-parser";
import { SokkerHttpClient, type SokkerCredentials } from "./sokker-http-client.js";
import {
  sokkerCountriesXmlSchema,
  sokkerTeamXmlSchema,
  sokkerPlayersXmlSchema,
  sokkerJuniorsXmlSchema
} from "@atlas/contracts";
import type { PlayerSnapshotV0 } from "@atlas/contracts";
import type { YouthAcademySnapshotV0 } from "@atlas/contracts";
import type { Money } from "../types.js";

export interface ClubObservedProfile {
  externalId: string;
  name: string;
  countryId: number;
  money: Money;
  season?: number;
  week?: number;
  training?: {
    gk: number | null;
    def: number | null;
    mid: number | null;
    att: number | null;
  } | null;
}

export interface CountryReference {
  id: number;
  name: string;
  currencyName: string;
  currencyRate: number;
}

export interface XmlImportResult {
  clubProfile: ClubObservedProfile;
  players: PlayerSnapshotV0["players"];
  juniors: YouthAcademySnapshotV0;
  source: string;
  importedAt: Date;
  countries: CountryReference[];
}

export class SokkerXmlProvider {
  private httpClient: SokkerHttpClient;
  private parser: XMLParser;

  constructor() {
    this.httpClient = new SokkerHttpClient();
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_"
    });
  }

  async importFullTeamData(credentials: SokkerCredentials): Promise<XmlImportResult> {
    // 1. Authenticate and get Team ID & Session
    const auth = await this.httpClient.login(credentials);

    // 2. Fetch XMLs concurrently
    const [teamXmlRaw, countriesXmlRaw, playersXmlRaw, juniorsXmlRaw] = await Promise.all([
      this.httpClient.fetchXml(`team-${auth.teamId}.xml`, auth.sessionId),
      this.httpClient.fetchXml("countries.xml", auth.sessionId),
      this.httpClient.fetchXml(`players-${auth.teamId}.xml`, auth.sessionId),
      this.httpClient.fetchXml("juniors.xml", auth.sessionId)
    ]);

    // 3. Parse XML to JSON
    const teamJson = this.parser.parse(teamXmlRaw);
    const countriesJson = this.parser.parse(countriesXmlRaw);
    const playersJson = this.parser.parse(playersXmlRaw);
    const juniorsJson = this.parser.parse(juniorsXmlRaw);

    // 4. Validate and extract data
    let teamData, countriesData, playersData, juniorsData;
    try {
      teamData = sokkerTeamXmlSchema.parse(teamJson).teamdata.team;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const keys = teamJson.teamdata ? Object.keys(teamJson.teamdata) : Object.keys(teamJson);
      throw new Error(`Team validation failed. Received keys: ${JSON.stringify(keys)}. Error: ${message}`);
    }

    try {
      countriesData = sokkerCountriesXmlSchema.parse(countriesJson).countries.country;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`Countries validation failed. Received keys: ${JSON.stringify(Object.keys(countriesJson))}. Error: ${message}`);
    }

    try {
      playersData = sokkerPlayersXmlSchema.parse(playersJson).players.player;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`Players validation failed. Received keys: ${JSON.stringify(Object.keys(playersJson))}. Error: ${message}`);
    }

    try {
      juniorsData = sokkerJuniorsXmlSchema.parse(juniorsJson).juniors.junior;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`Juniors validation failed. Received keys: ${JSON.stringify(Object.keys(juniorsJson))}. Error: ${message}`);
    }

    // 5. Data Mapping & Currency Conversion
    
    // Normalize countries into CountryReference
    const countries = (Array.isArray(countriesData) ? countriesData : [countriesData]).map(c => ({
      id: c.countryID,
      name: c.name,
      currencyName: c.currencyName,
      currencyRate: c.currencyRate
    }));

    // Do not convert money; store the base value from XML.
    // The frontend will convert it using the Country model.
    const convertMoney = (amount: number): Money => ({
      amount,
      currency: null // Will be populated by the frontend or API layer using the Country collection
    });

    const clubProfile: ClubObservedProfile = {
      externalId: String(teamData.teamID),
      name: teamData.name,
      countryId: teamData.countryID,
      money: convertMoney(teamData.money),
      season: teamData.season,
      week: teamData.week,
      training: {
        gk: teamData.trainingTypeGk ?? null,
        def: teamData.trainingTypeDef ?? null,
        mid: teamData.trainingTypeMid ?? null,
        att: teamData.trainingTypeAtt ?? null
      }
    };

    const playersArray = Array.isArray(playersData) ? playersData : (playersData ? [playersData] : []);
    const players: PlayerSnapshotV0["players"] = playersArray.map(p => {
      const name = p.surname ? `${p.name} ${p.surname}` : p.name;
      return {
        externalId: String(p.ID),
        name: name,
        age: p.age,
        wage: convertMoney(p.wage),
        estimatedValue: convertMoney(p.value),
        form: p.skillForm ?? 10,
        availabilityStatus: "available", // To be refined
        observedPosition: "undefined", // To be refined
        skills: {
          stamina: p.skillStamina,
          pace: p.skillPace,
          technique: p.skillTechnique,
          passing: p.skillPassing,
          keeper: p.skillKeeper,
          defender: p.skillDefending,
          playmaker: p.skillPlaymaking,
          striker: p.skillScoring
        }
      };
    });

    const juniorsArray = Array.isArray(juniorsData) ? juniorsData : (juniorsData ? [juniorsData] : []);
    const juniors: YouthAcademySnapshotV0 = {
      schemaVersion: "atlas.youth-academy-snapshot.v0",
      source: {
        type: "sokker-dom-export", // Assuming we use same type or we can use sokker-xml-import
        exportedAt: new Date().toISOString(),
        locale: null
      },
      club: {
        clubId: teamData.teamID,
        country: teamData.countryID,
        name: teamData.name,
        training: {
          gk: teamData.trainingTypeGk ?? null,
          def: teamData.trainingTypeDef ?? null,
          mid: teamData.trainingTypeMid ?? null,
          att: teamData.trainingTypeAtt ?? null
        }
      },
      snapshot: {
        snapshotDate: new Date().toISOString().split("T")[0]!,
        season: teamData.season,
        week: teamData.week
      },
      academy: {
        players: juniorsArray.map(j => {
          const name = j.surname ? `${j.name} ${j.surname}` : j.name;
          return {
            externalId: String(j.ID),
            name: name,
            age: j.age,
            weeksRemaining: j.weeks, // Assuming weeks means weeks remaining based on XML docs
            estimatedLevel: String(j.skill),
            status: "in_academy" // Inferred or mapped later
          };
        })
      }
    };

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
