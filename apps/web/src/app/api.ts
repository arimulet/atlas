import type { ClubDashboard, ImportResponse, SquadEconomy } from "./types";

export async function fetchClubDashboard(clubId: string): Promise<ClubDashboard> {
  const response = await fetch(`/api/clubs/${clubId}/dashboard`);
  const body = (await response.json()) as { dashboard?: ClubDashboard };

  if (!response.ok || !body.dashboard) {
    throw new Error("Dashboard API returned an unexpected response.");
  }

  return body.dashboard;
}

export async function fetchSquadEconomy(clubId: string): Promise<SquadEconomy> {
  const response = await fetch(`/api/clubs/${clubId}/squad-economy`);
  const body = (await response.json()) as { squadEconomy?: SquadEconomy };

  if (!response.ok || !body.squadEconomy) {
    throw new Error("Squad economy API returned an unexpected response.");
  }

  return body.squadEconomy;
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
