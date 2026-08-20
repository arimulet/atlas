import type {
  ClubDashboard,
  ImportResponse,
  PlayerDevelopment,
  RealYouthAcademyPlanning,
  SquadPlanningData,
  TrainingPageData,
  WeeklyTrainingIntelligence,
  YouthPipelinePlanning
} from "./types";
import type { YouthDecisionPlanning } from "@atlas/application";
import type {
  PlayerDevelopmentTargetOverride,
  SquadDepthAnalysis,
  SquadPlanningRecommendations,
  SquadRole
} from "@atlas/domain";

export interface PlayerDevelopmentTargetOverrideResponse {
  id: string;
  playerId: number;
  clubId: number;
  profile: PlayerDevelopmentTargetOverride["profile"];
  targetLevels: NonNullable<PlayerDevelopmentTargetOverride["targetLevels"]>;
  targetAge: number | null;
}

export async function fetchClubDashboard(clubId: string): Promise<ClubDashboard> {
  const response = await fetch(`/api/clubs/${clubId}/dashboard`);
  const body = (await response.json()) as ClubDashboard;

  if (!response.ok || !body) {
    throw new Error("Dashboard API returned an unexpected response.");
  }

  return body;
}

export async function fetchTrainingPageData(clubId: string): Promise<TrainingPageData> {
  const response = await fetch(`/api/clubs/${clubId}/training`);
  const body = (await response.json()) as TrainingPageData;

  if (!response.ok || !body) {
    throw new Error("Training API returned an unexpected response.");
  }

  return body;
}

export async function fetchWeeklyTrainingIntelligence(
  clubId: string
): Promise<WeeklyTrainingIntelligence> {
  const response = await fetch(`/api/clubs/${clubId}/training/intelligence`);
  const body = (await response.json()) as WeeklyTrainingIntelligence;

  if (!response.ok || !body) {
    throw new Error("Weekly Training Intelligence API returned an unexpected response.");
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

export async function fetchSquadPlanning(clubId: string): Promise<SquadPlanningData> {
  const response = await fetch(`/api/clubs/${clubId}/players/squad-planning`);
  const body = (await response.json()) as SquadPlanningData;

  if (!response.ok || !body) {
    throw new Error("Squad Planning API returned an unexpected response.");
  }

  return body;
}

export async function fetchSquadDepthAnalysis(clubId: string): Promise<SquadDepthAnalysis> {
  const response = await fetch(`/api/clubs/${clubId}/players/squad-depth`);
  const body = (await response.json()) as SquadDepthAnalysis;

  if (!response.ok || !body) {
    throw new Error("Squad depth API returned an unexpected response.");
  }

  return body;
}

export async function fetchSquadPlanningRecommendations(
  clubId: string
): Promise<SquadPlanningRecommendations> {
  const response = await fetch(`/api/clubs/${clubId}/players/squad-planning-recommendations`);
  const body = (await response.json()) as SquadPlanningRecommendations;

  if (!response.ok || !body) {
    throw new Error("Squad planning recommendations API returned an unexpected response.");
  }

  return body;
}

export async function saveSquadRoleAssignment(
  clubId: string,
  playerId: string,
  role: SquadRole
): Promise<void> {
  const response = await fetch(`/api/clubs/${clubId}/players/${playerId}/squad-role`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role })
  });

  if (!response.ok) {
    throw new Error("Squad role API returned an unexpected response.");
  }
}

export async function resetSquadRoleAssignment(clubId: string, playerId: string): Promise<void> {
  const response = await fetch(`/api/clubs/${clubId}/players/${playerId}/squad-role`, {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error("Squad role API returned an unexpected response.");
  }
}

export async function fetchPlayerDevelopmentTarget(
  clubId: string,
  playerId: string
): Promise<PlayerDevelopmentTargetOverrideResponse | null> {
  const response = await fetch(`/api/clubs/${clubId}/players/${playerId}/development-target`);

  if (response.status === 404) {
    return null;
  }

  const body = (await response.json()) as PlayerDevelopmentTargetOverrideResponse | null;

  if (!response.ok) {
    throw new Error("Development target API returned an unexpected response.");
  }

  return body;
}

export async function savePlayerDevelopmentTarget(
  clubId: string,
  playerId: string,
  override: PlayerDevelopmentTargetOverride
): Promise<PlayerDevelopmentTargetOverrideResponse> {
  const response = await fetch(`/api/clubs/${clubId}/players/${playerId}/development-target`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(override)
  });
  const body = (await response.json()) as PlayerDevelopmentTargetOverrideResponse;

  if (!response.ok || !body) {
    throw new Error("Development target API returned an unexpected response.");
  }

  return body;
}

export async function resetPlayerDevelopmentTarget(
  clubId: string,
  playerId: string
): Promise<void> {
  const response = await fetch(`/api/clubs/${clubId}/players/${playerId}/development-target`, {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error("Development target API returned an unexpected response.");
  }
}

export async function fetchYouthPipelinePlanning(clubId: string): Promise<YouthPipelinePlanning> {
  const response = await fetch(`/api/clubs/${clubId}/players/youth-pipeline-planning`);
  const body = (await response.json()) as YouthPipelinePlanning;

  if (!response.ok || !body) {
    throw new Error("Youth pipeline planning API returned an unexpected response.");
  }

  return body;
}

export async function fetchYouthDecisionPlanning(clubId: string): Promise<YouthDecisionPlanning> {
  const response = await fetch(`/api/clubs/${clubId}/players/youth-decision-planning`);
  const body = (await response.json()) as YouthDecisionPlanning;

  if (!response.ok || !body) {
    throw new Error("Youth decision planning API returned an unexpected response.");
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

export async function syncSokker(payload: unknown): Promise<{
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
