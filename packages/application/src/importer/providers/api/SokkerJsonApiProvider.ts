import type {
  SokkerCountryDto,
  SokkerCurrentDto,
  SokkerJuniorDto,
  PlayerTrainingWeekDto,
  SokkerPlayerDto,
  SokkerImportResultDto,
  SokkerTeamDto
} from "../../types.js";
import type { SokkerCredentials } from "../../types.js";
import type { SokkerDataProvider } from "../SokkerDataProvider.js";
import { assembleSokkerTeamData } from "../assemble-sokker-data.js";
import type {
  SokkerApiCurrentDto,
  SokkerApiJuniorDto,
  SokkerApiPlayerDto,
  SokkerApiTrainingResponseDto
} from "./dtos.js";
import {
  mapApiCurrentToSokkerCurrentDto,
  mapApiJuniorToSokkerJuniorDto,
  mapApiTrainingPlayerToPlayerTrainingWeekDto,
  mapApiPlayerToSokkerPlayerDto,
  mapApiTeamToSokkerTeamDto
} from "./mappers.js";

export class SokkerJsonApiProvider implements SokkerDataProvider {
  private sessionCookie: string | null = null;
  private loginPromise: Promise<void> | null = null;
  private currentResponse: SokkerApiCurrentDto | null = null;

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
    const teamData = await assembleSokkerTeamData(this);
    return { ...teamData, training: await this.getCurrentTraining() };
  }

  async getCurrent(): Promise<SokkerCurrentDto> {
    const response = await this.get<SokkerApiCurrentDto>("current");
    this.currentResponse = response;

    return mapApiCurrentToSokkerCurrentDto(response);
  }

  async getTeam(teamId: number): Promise<SokkerTeamDto> {
    const response = this.currentResponse ?? (await this.get<SokkerApiCurrentDto>("current"));
    this.currentResponse = response;
    const team = response.team;

    if (!team || team.id !== teamId) {
      throw new Error(`Sokker current response did not provide team ${teamId}.`);
    }

    return mapApiTeamToSokkerTeamDto({ ...response, ...team });
  }

  async getPlayers(teamId: number): Promise<SokkerPlayerDto[]> {
    const response = await this.get<unknown>("player", {
      "filter[team]": teamId,
      "filter[limit]": 200,
      "filter[offset]": 0
    });
    const players = readApiCollection<SokkerApiPlayerDto>(response, "players");

    return players.map(mapApiPlayerToSokkerPlayerDto);
  }

  async getJuniors(): Promise<SokkerJuniorDto[]> {
    const response = await this.get<unknown>("junior");
    const juniors = readApiCollection<SokkerApiJuniorDto>(response, "juniors");

    return juniors.map(mapApiJuniorToSokkerJuniorDto);
  }

  async getCountries(): Promise<SokkerCountryDto[]> {
    return [];
  }

  async getCurrentTraining(): Promise<PlayerTrainingWeekDto[]> {
    return this.getTraining("training");
  }

  async getTrainingSummary(week?: number): Promise<PlayerTrainingWeekDto[]> {
    return this.getTraining("training/summary", week === undefined ? undefined : { week });
  }

  async getPlayerTrainingReport(playerId: number): Promise<PlayerTrainingWeekDto[]> {
    return this.getTraining(`training/${playerId}/report`);
  }

  private async getTraining(
    path: string,
    params?: Record<string, number>
  ): Promise<PlayerTrainingWeekDto[]> {
    const response = await this.get<SokkerApiTrainingResponseDto>(path, params);
    return response.players.map(mapApiTrainingPlayerToPlayerTrainingWeekDto);
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
      throw new Error(
        `Sokker API request failed (${response.status}) for ${url.pathname}${url.search}: ${response.statusText}`
      );
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

function readApiCollection<T>(response: unknown, resourceName: string): T[] {
  const collection = findApiCollection(response, resourceName, new Set<object>());
  if (collection) {
    return collection as T[];
  }

  throw new Error(`Sokker API ${resourceName} response did not contain a collection.`);
}

function findApiCollection(
  value: unknown,
  resourceName: string,
  visited: Set<object>
): unknown[] | null {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isRecord(value) || visited.has(value)) {
    return null;
  }

  visited.add(value);

  for (const key of [resourceName, "data", "items", "results"]) {
    const nested = value[key];
    if (Array.isArray(nested)) {
      return nested;
    }
  }

  for (const nested of Object.values(value)) {
    const collection = findApiCollection(nested, resourceName, visited);
    if (collection) {
      return collection;
    }
  }

  return null;
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
