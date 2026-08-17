import type {
  SokkerCountryDto,
  SokkerCurrentDto,
  SokkerJuniorDto,
  SokkerLeagueDto,
  SokkerMatchPlayerStatsDto,
  SokkerMatchSummaryDto,
  SokkerPlayerDto,
  SokkerImportResultDto,
  SokkerTeamDto
} from "../../types.js";
import type { SokkerCredentials } from "../../types.js";
import type { SokkerDataProvider } from "../SokkerDataProvider.js";
import { assembleSokkerTeamData } from "../assemble-sokker-data.js";
import type {
  SokkerApiCountryDto,
  SokkerApiCurrentDto,
  SokkerApiJuniorDto,
  SokkerApiLeagueDto,
  SokkerApiMatchDto,
  SokkerApiMatchPlayerStatsDto,
  SokkerApiPlayerDto,
  SokkerApiTeamDto
} from "./dtos.js";
import {
  mapApiCountryToSokkerCountryDto,
  mapApiCurrentToSokkerCurrentDto,
  mapApiJuniorToSokkerJuniorDto,
  mapApiLeagueToSokkerLeagueDto,
  mapApiMatchPlayerStatsToSokkerMatchPlayerStatsDto,
  mapApiMatchToSokkerMatchSummaryDto,
  mapApiPlayerToSokkerPlayerDto,
  mapApiTeamToSokkerTeamDto
} from "./mappers.js";

export class SokkerJsonApiProvider implements SokkerDataProvider {
  private sessionCookie: string | null = null;
  private loginPromise: Promise<void> | null = null;

  constructor(private readonly credentials: SokkerCredentials) {}

  async login(): Promise<void> {
    if (this.sessionCookie) {
      return;
    }

    this.loginPromise ??= this.authenticate();

    try {
      await this.loginPromise;
    } finally {
      this.loginPromise = null;
    }
  }

  async getFullTeamData(): Promise<SokkerImportResultDto> {
    return assembleSokkerTeamData(this, "sokker-json-api-import");
  }

  async getCurrent(): Promise<SokkerCurrentDto> {
    const response = await this.get<SokkerApiCurrentDto>("current");

    return mapApiCurrentToSokkerCurrentDto(response);
  }

  async getTeam(teamId: number): Promise<SokkerTeamDto> {
    const response = await this.get<SokkerApiTeamDto>(`teams/${teamId}`);

    return mapApiTeamToSokkerTeamDto(response);
  }

  async getPlayers(teamId: number): Promise<SokkerPlayerDto[]> {
    const response = await this.get<SokkerApiPlayerDto[]>(`teams/${teamId}/players`);

    return response.map(mapApiPlayerToSokkerPlayerDto);
  }

  async getJuniors(teamId: number): Promise<SokkerJuniorDto[]> {
    const response = await this.get<SokkerApiJuniorDto[]>(`teams/${teamId}/juniors`);

    return response.map(mapApiJuniorToSokkerJuniorDto);
  }

  async getCountries(): Promise<SokkerCountryDto[]> {
    const response = await this.get<SokkerApiCountryDto[]>("countries");

    return response.map(mapApiCountryToSokkerCountryDto);
  }

  async getMatches(teamId: number): Promise<SokkerMatchSummaryDto[]> {
    const response = await this.get<SokkerApiMatchDto[]>(`teams/${teamId}/matches`);

    return response.map(mapApiMatchToSokkerMatchSummaryDto);
  }

  async getMatch(matchId: number): Promise<SokkerMatchSummaryDto> {
    const response = await this.get<SokkerApiMatchDto>(`matches/${matchId}`);

    return mapApiMatchToSokkerMatchSummaryDto(response);
  }

  async getMatchLineup(matchId: number, teamId?: number): Promise<SokkerMatchPlayerStatsDto[]> {
    const response = await this.get<SokkerApiMatchPlayerStatsDto[]>(
      `matches/${matchId}/lineup`,
      teamId === undefined ? undefined : { teamId }
    );

    return response.map(mapApiMatchPlayerStatsToSokkerMatchPlayerStatsDto);
  }

  async getLeague(leagueId: number): Promise<SokkerLeagueDto> {
    const response = await this.get<SokkerApiLeagueDto>(`leagues/${leagueId}`);

    return mapApiLeagueToSokkerLeagueDto(response);
  }

  private async get<T>(path: string, params?: unknown): Promise<T> {
    await this.login();

    const url = new URL(path, ensureTrailingSlash("https://sokker.org/api"));
    appendQueryParams(url.searchParams, params);

    const sessionCookie = this.sessionCookie;
    if (!sessionCookie) {
      throw new Error("Sokker JSON API provider is not authenticated.");
    }

    const response = await fetch(url, {
      method: "GET",
      headers: { Cookie: sessionCookie }
    });

    if (!response.ok) {
      throw new Error(`Sokker API request failed (${response.status}): ${response.statusText}`);
    }

    return (await response.json()) as T;
  }

  private async authenticate(): Promise<void> {
    const response = await fetch("https://sokker.org/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        login: this.credentials.login,
        password: this.credentials.password,
        remember: false
      })
    });
    const body = await response.text();

    if (!response.ok) {
      throw new Error(`Sokker API authentication failed (${response.status}): ${body}`);
    }

    this.sessionCookie = readSessionCookie(response.headers.get("set-cookie"));
  }
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function appendQueryParams(searchParams: URLSearchParams, params: unknown): void {
  if (!isRecord(params)) {
    return;
  }

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }

    searchParams.set(key, String(value));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readSessionCookie(setCookie: string | null): string {
  const match = setCookie?.match(/PHPSESSID=([^;]+)/);

  if (!match?.[1]) {
    throw new Error("No JSON API session cookie received from Sokker.");
  }

  return `PHPSESSID=${match[1]}`;
}
