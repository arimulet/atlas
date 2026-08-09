import type {
  ClubDashboard,
  ImportResponse,
  PlayerDevelopment,
  RealYouthAcademyPlanning,
  SquadEconomy,
  SquadMarketPlanning,
  YouthPipelinePlanning
} from "./types";

export async function fetchClubDashboard(clubId: string): Promise<ClubDashboard> {
  const response = await fetch(`/api/clubs/${clubId}/dashboard`);
  const body = (await response.json()) as ClubDashboard;

  if (!response.ok || !body) {
    throw new Error("Dashboard API returned an unexpected response.");
  }

  return body;
}

export async function fetchSquadEconomy(clubId: string): Promise<SquadEconomy> {
  const response = await fetch(`/api/clubs/${clubId}/economy`);
  const body = (await response.json()) as SquadEconomy;

  if (!response.ok || !body) {
    throw new Error("Squad economy API returned an unexpected response.");
  }

  return body;
}

export async function fetchPlayerDevelopment(clubId: string): Promise<PlayerDevelopment> {
  const response = await fetch(`/api/clubs/${clubId}/players/development`);
  const body = (await response.json()) as PlayerDevelopment;

  if (!response.ok || !body) {
    throw new Error("Player development API returned an unexpected response.");
  }

  return body;
}

export async function fetchSquadMarketPlanning(clubId: string): Promise<SquadMarketPlanning> {
  const response = await fetch(`/api/clubs/${clubId}/economy/squad-market-planning`);
  const body = (await response.json()) as SquadMarketPlanning;

  if (!response.ok || !body) {
    throw new Error("Squad market planning API returned an unexpected response.");
  }

  return body;
}

export async function fetchYouthPipelinePlanning(clubId: string): Promise<YouthPipelinePlanning> {
  const response = await fetch(`/api/clubs/${clubId}/players/youth-pipeline-planning`);
  const body = (await response.json()) as YouthPipelinePlanning;

  if (!response.ok || !body) {
    throw new Error("Youth pipeline planning API returned an unexpected response.");
  }

  return body;
}

export async function fetchRealYouthAcademyPlanning(
  clubId: string
): Promise<RealYouthAcademyPlanning> {
  const response = await fetch(`/api/clubs/${clubId}/players/youth-academy`);
  const body = (await response.json()) as RealYouthAcademyPlanning;

  if (!response.ok || !body) {
    throw new Error("Real youth academy planning API returned an unexpected response.");
  }

  return body;
}

export async function importPlayerSnapshot(payload: unknown): Promise<{
  response: Response;
  body: ImportResponse;
}> {
  const response = await fetch("/api/imports/player-snapshot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  return { response, body: await readImportResponse(response) };
}

export async function syncSokkerXml(payload: unknown): Promise<{
  response: Response;
  body: ImportResponse;
}> {
  const response = await fetch("/api/imports/sokker-sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  return { response, body: await readImportResponse(response) };
}

async function readImportResponse(response: Response): Promise<ImportResponse> {
  const text = await response.text();

  if (!text.trim()) {
    return createEndpointError(
      "The import API returned an empty response. Check that the API server and MongoDB connection are running."
    );
  }

  try {
    const parsed = JSON.parse(text) as Partial<ImportResponse>;

    if (!parsed.importResult) {
      return createEndpointError(
        `The import API returned an unexpected response with HTTP ${response.status}.`
      );
    }

    return parsed as ImportResponse;
  } catch {
    return createEndpointError(
      `The import API returned a non-JSON response with HTTP ${response.status}.`
    );
  }
}

function createEndpointError(message: string): ImportResponse {
  return {
    importResult: {
      status: "rejected",
      errors: [{ path: "api", message }],
      warnings: [],
      clubId: null,
      importedPlayerCount: 0
    },
    summary: null,
    diagnostic: null
  };
}
