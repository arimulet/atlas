import type { SokkerCredentials } from "../../types.js";

export interface SokkerApiClientOptions {
  baseUrl?: string;
  headers?: HeadersInit;
  fetchImplementation?: typeof fetch;
  credentials?: SokkerCredentials;
}

export class SokkerApiClient {
  private readonly fetchImplementation: typeof fetch;

  constructor(private readonly options: SokkerApiClientOptions = {}) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
  }

  async get<T>(path: string, params?: unknown): Promise<T> {
    const url = new URL(
      path,
      ensureTrailingSlash(this.options.baseUrl ?? "https://sokker.org/api")
    );
    appendQueryParams(url.searchParams, params);

    const response = await this.fetchImplementation(url, {
      method: "GET",
      headers: this.options.headers
    });

    if (!response.ok) {
      throw new Error(`Sokker API request failed (${response.status}): ${response.statusText}`);
    }

    return (await response.json()) as T;
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
