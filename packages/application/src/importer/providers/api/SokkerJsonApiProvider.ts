import type { SokkerCredentials } from "../../types.js";
import type {
  CurrentClubContextDto,
  JuniorDto,
  TrainerDto,
  TrainingDataDto,
  TrainingSummaryDto
} from "../../types.js";
import type { SokkerDataProvider } from "../SokkerDataProvider.js";
import type {
  SokkerCurrentApiDto,
  SokkerJuniorsApiDto,
  SokkerTrainersApiDto,
  SokkerTrainingApiDto,
  SokkerTrainingSummaryApiDto
} from "./dtos.js";
import {
  mapCurrentApiToCurrentClubContext,
  mapJuniorsApiToJuniors,
  mapTrainersApiToTrainers,
  mapTrainingApiToTrainingData,
  mapTrainingSummaryApiToTrainingSummary
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

  async getCurrent(): Promise<CurrentClubContextDto> {
    const response = await this.get<SokkerCurrentApiDto>("current");

    return mapResource("current", () => mapCurrentApiToCurrentClubContext(response));
  }

  async getTraining(): Promise<TrainingDataDto> {
    const response = await this.get<SokkerTrainingApiDto>("training");

    return mapResource("training", () => mapTrainingApiToTrainingData(response.players));
  }

  async getTrainers(): Promise<TrainerDto[]> {
    const response = await this.get<SokkerTrainersApiDto>("trainer");

    return mapResource("trainer", () => mapTrainersApiToTrainers(response.trainers));
  }

  async getJuniors(): Promise<JuniorDto[]> {
    const response = await this.get<SokkerJuniorsApiDto>("junior");

    return mapResource("junior", () => mapJuniorsApiToJuniors(response.juniors));
  }

  async getTrainingSummary(): Promise<TrainingSummaryDto> {
    const response = await this.get<SokkerTrainingSummaryApiDto>("training/summary");

    return mapResource("training summary", () => mapTrainingSummaryApiToTrainingSummary(response));
  }

  private async get<T>(path: string): Promise<T> {
    await this.login();

    const url = new URL(path, ensureTrailingSlash("https://sokker.org/api"));
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
    await response.text();

    if (!response.ok) {
      throw new Error(`Sokker API authentication failed (${response.status}).`);
    }

    this.sessionCookie = readSessionCookie(response.headers.get("set-cookie"));
  }
}

function mapResource<T>(resource: string, mapper: () => T): T {
  try {
    return mapper();
  } catch (cause) {
    throw new Error(`Failed to map Sokker ${resource} response.`, { cause });
  }
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function readSessionCookie(setCookie: string | null): string {
  const match = setCookie?.match(/PHPSESSID=([^;]+)/);

  if (!match?.[1]) {
    throw new Error("No JSON API session cookie received from Sokker.");
  }

  return `PHPSESSID=${match[1]}`;
}
