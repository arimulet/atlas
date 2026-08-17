import { XMLParser } from "fast-xml-parser";
import {
  sokkerCountriesXmlSchema,
  sokkerJuniorsXmlSchema,
  sokkerPlayersXmlSchema,
  sokkerTeamXmlSchema,
  sokkerVarsXmlSchema
} from "@atlas/contracts";
import { normalizeSeasonWeek } from "@atlas/domain";

import type {
  SokkerCountryDto,
  SokkerCurrentDto,
  SokkerAuthResult,
  SokkerJuniorDto,
  PlayerTrainingWeekDto,
  SokkerPlayerDto,
  SokkerImportResultDto,
  SokkerTeamDto
} from "../../types.js";
import type { SokkerDataProvider } from "../SokkerDataProvider.js";
import { assembleSokkerTeamData } from "../assemble-sokker-data.js";
import type { SokkerCredentials } from "../../types.js";

const sessionCache = new Map<string, SokkerAuthResult & { expiresAt: number }>();

export class SokkerXmlProvider implements SokkerDataProvider {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_"
  });

  private session: SokkerAuthResult | null = null;
  private readonly credentials: SokkerCredentials;

  constructor(credentials: SokkerCredentials) {
    this.credentials = credentials;
  }

  async login(): Promise<SokkerAuthResult> {
    const cached = sessionCache.get(this.credentials.login);
    if (cached && cached.expiresAt > Date.now()) {
      this.session = { sessionId: cached.sessionId, teamId: cached.teamId };
      return this.session;
    }

    const params = new URLSearchParams();
    params.append("ilogin", this.credentials.login);
    params.append("ipassword", this.credentials.password);

    const response = await fetch("https://sokker.org/start.php?session=xml", {
      method: "POST",
      body: params
    });
    const body = await response.text();

    if (!body.includes("OK")) {
      throw new Error(`Sokker authentication failed: ${body}`);
    }

    const teamIdMatch = body.match(/teamID=(\d+)/);
    if (!teamIdMatch?.[1]) {
      throw new Error(`Could not parse Team ID from Sokker response: ${body}`);
    }

    const sessionId = readSessionId(response.headers.get("set-cookie"));
    this.session = { sessionId, teamId: teamIdMatch[1] };
    sessionCache.set(this.credentials.login, {
      ...this.session,
      expiresAt: Date.now() + 1000 * 60 * 30
    });

    return this.session;
  }

  async fetchXml(filename: string, sessionId?: string): Promise<string> {
    const session = sessionId ? { sessionId } : await this.ensureAuthenticated();

    const response = await fetch(`https://sokker.org/xml/${filename}`, {
      headers: { Cookie: `XMLSESSID=${session.sessionId}` }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${filename}: ${response.statusText}`);
    }

    return response.text();
  }

  async getFullTeamData(): Promise<SokkerImportResultDto> {
    return assembleSokkerTeamData(this, "sokker-xml-import");
  }

  async getCurrent(): Promise<SokkerCurrentDto> {
    const parsed = this.parseXml(await this.fetchXml("vars.xml"));
    const data = parseWithContext("Vars", sokkerVarsXmlSchema, parsed).vars;

    return {
      gameWeek: data.week,
      week: normalizeSeasonWeek(data.week),
      teamId: Number(this.requireSession().teamId)
    };
  }

  async getTeam(teamId: number): Promise<SokkerTeamDto> {
    const parsed = this.parseXml(await this.fetchXml(`team-${teamId}.xml`));
    const team = parseWithContext("Team", sokkerTeamXmlSchema, parsed).teamdata.team;

    return {
      id: team.teamID,
      name: team.name,
      countryId: team.countryID,
      money: { amount: team.money, currency: null },
      season: team.season,
      training: {
        gk: team.trainingTypeGk ?? null,
        def: team.trainingTypeDef ?? null,
        mid: team.trainingTypeMid ?? null,
        att: team.trainingTypeAtt ?? null
      }
    };
  }

  async getPlayers(teamId: number): Promise<SokkerPlayerDto[]> {
    const parsed = this.parseXml(await this.fetchXml(`players-${teamId}.xml`));
    const players = parseWithContext("Players", sokkerPlayersXmlSchema, parsed).players.player;

    return asArray(players).map((player) => ({
      playerId: player.ID,
      name: joinName(player.name, player.surname),
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
    }));
  }

  async getJuniors(teamId: number): Promise<SokkerJuniorDto[]> {
    // The current XML endpoint is account-scoped and is always named juniors.xml.
    void teamId;
    const parsed = this.parseXml(await this.fetchXml("juniors.xml"));
    const juniors = parseWithContext("Juniors", sokkerJuniorsXmlSchema, parsed).juniors.junior;

    return asArray(juniors).map((junior) => ({
      playerId: junior.ID,
      name: joinName(junior.name, junior.surname),
      age: junior.age,
      initialWeeksRemaining: junior.weeks,
      weeksRemaining: junior.weeks,
      skill: junior.skill,
      status: "in_academy"
    }));
  }

  async getCountries(): Promise<SokkerCountryDto[]> {
    const parsed = this.parseXml(await this.fetchXml("countries.xml"));
    const countries = parseWithContext("Countries", sokkerCountriesXmlSchema, parsed).countries
      .country;

    return asArray(countries).map((country) => ({
      id: country.countryID,
      name: country.name,
      currencyName: country.currencyName,
      currencyRate: country.currencyRate
    }));
  }

  async getCurrentTraining(): Promise<PlayerTrainingWeekDto[]> {
    return unsupportedTrainingSource();
  }

  async getTrainingSummary(): Promise<PlayerTrainingWeekDto[]> {
    return unsupportedTrainingSource();
  }

  async getPlayerTrainingReport(): Promise<PlayerTrainingWeekDto[]> {
    return unsupportedTrainingSource();
  }

  private async ensureAuthenticated(): Promise<SokkerAuthResult> {
    if (this.session) {
      return this.session;
    }

    return this.login();
  }

  private parseXml(xml: string): Record<string, unknown> {
    return this.parser.parse(xml) as Record<string, unknown>;
  }

  private requireSession(): SokkerAuthResult {
    if (!this.session) {
      throw new Error("Sokker XML provider is not authenticated.");
    }

    return this.session;
  }
}

function unsupportedTrainingSource(): never {
  throw new Error("The XML Sokker source does not expose the JSON training report.");
}

function readSessionId(setCookie: string | null): string {
  const match = setCookie?.match(/XMLSESSID=([^;]+)/);

  if (!match?.[1]) {
    throw new Error("No session cookie received from Sokker");
  }

  return match[1];
}

function joinName(name: string, surname: string | undefined): string {
  return surname ? `${name} ${surname}` : name;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function parseWithContext<TData>(
  resource: string,
  schema: { parse(input: unknown): TData },
  input: unknown
): TData {
  try {
    return schema.parse(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const keys = isRecord(input) ? Object.keys(input) : [];

    throw new Error(
      `${resource} validation failed. Received keys: ${JSON.stringify(keys)}. Error: ${message}`
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
