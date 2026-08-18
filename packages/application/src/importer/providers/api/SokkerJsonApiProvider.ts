import type { SokkerCredentials } from "../../types.js";
import type { SokkerDataProvider } from "../SokkerDataProvider.js";
import type {
  SokkerCurrentApiDto,
  SokkerJuniorsApiDto,
  SokkerTrainersApiDto,
  SokkerTrainingApiDto,
  SokkerTrainingSummaryApiDto
} from "./dtos.js";

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

  getCurrent(): Promise<SokkerCurrentApiDto> {
    return this.get("current");
  }

  getTraining(): Promise<SokkerTrainingApiDto> {
    return this.get("training");
  }

  getTrainers(): Promise<SokkerTrainersApiDto> {
    return this.get("trainer");
  }

  getJuniors(): Promise<SokkerJuniorsApiDto> {
    return this.get("junior");
  }

  getTrainingSummary(): Promise<SokkerTrainingSummaryApiDto> {
    return this.get("training/summary");
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

function readSessionCookie(setCookie: string | null): string {
  const match = setCookie?.match(/PHPSESSID=([^;]+)/);

  if (!match?.[1]) {
    throw new Error("No JSON API session cookie received from Sokker.");
  }

  return `PHPSESSID=${match[1]}`;
}
