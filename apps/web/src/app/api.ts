import type {
  ClubDashboard,
  DiagnosticFinding,
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
  CapitalAllocationPlan,
  ClubFinancialAssessment,
  FinancialStrategyPlan,
  InvestmentSafetyAssessment,
  PlayerDevelopmentTargetOverride,
  SquadDepthAnalysis,
  SquadPlanningRecommendations,
  SquadRole
} from "@atlas/domain";
import { auth } from "./services/firebase";

export interface FinancialStrategyData {
  financialAssessment: ClubFinancialAssessment;
  capitalAllocation: CapitalAllocationPlan;
  strategyPlan: FinancialStrategyPlan;
}

export interface PlayerDevelopmentTargetOverrideResponse {
  id: string;
  playerId: number;
  clubId: number;
  profile: PlayerDevelopmentTargetOverride["profile"];
  targetLevels: NonNullable<PlayerDevelopmentTargetOverride["targetLevels"]>;
}

async function fetchAuthenticated(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);

  if (!headers.has("Authorization")) {
    try {
      if (typeof auth?.authStateReady === "function") {
        await auth.authStateReady();
      }
      const user = auth?.currentUser;

      if (user) {
        const token = await user.getIdToken();
        headers.set("Authorization", `Bearer ${token}`);
      }
    } catch {
      // Ignore client auth resolution errors
    }
  }

  let url = input;
  if (typeof window === "undefined") {
    if (!headers.has("Authorization")) {
      try {
        const { cookies, headers: nextHeaders } = await import("next/headers");
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get("__session")?.value;
        if (sessionCookie) {
          headers.set("Authorization", `Bearer ${sessionCookie}`);
          headers.set("Cookie", `__session=${sessionCookie}`);
        } else {
          const reqHeaders = await nextHeaders();
          const authHeader = reqHeaders.get("authorization");
          if (authHeader) {
            headers.set("Authorization", authHeader);
          }
        }
      } catch {
        // Ignore when invoked outside Next.js server environment context
      }
    }

    if (typeof input === "string" && input.startsWith("/") && process.env.NODE_ENV !== "test") {
      const apiUrl = process.env.ATLAS_API_URL || "http://127.0.0.1:3001";
      url = `${apiUrl}${input}`;
    }
  }

  return fetch(url, { ...init, headers });
}

export async function fetchClubDashboard(_clubId?: string): Promise<ClubDashboard> {
  const response = await fetchAuthenticated("/api/club/dashboard");
  const body = (await response.json()) as ClubDashboard;

  if (!response.ok || !body) {
    throw new Error("Dashboard API returned an unexpected response.");
  }

  return body;
}

export async function fetchFinancialStrategy(_clubId?: string): Promise<FinancialStrategyData> {
  const response = await fetchAuthenticated("/api/club/financial-strategy");
  const body = (await response.json()) as FinancialStrategyData;

  if (!response.ok || !body) {
    throw new Error("Financial strategy API returned an unexpected response.");
  }

  return body;
}

export async function fetchInvestmentSafety(
  _clubId: string | number | null | undefined,
  amount: number
): Promise<InvestmentSafetyAssessment>;
export async function fetchInvestmentSafety(amount: number): Promise<InvestmentSafetyAssessment>;
export async function fetchInvestmentSafety(
  firstArg: unknown,
  secondArg?: number
): Promise<InvestmentSafetyAssessment> {
  const amount = typeof firstArg === "number" ? firstArg : secondArg!;
  const response = await fetchAuthenticated("/api/club/financial-strategy/investment-safety", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount })
  });
  const body = (await response.json()) as InvestmentSafetyAssessment;

  if (!response.ok || !body) {
    throw new Error("Investment safety API returned an unexpected response.");
  }

  return body;
}

export async function fetchTrainingPageData(_clubId?: string): Promise<TrainingPageData> {
  const response = await fetchAuthenticated("/api/club/training");
  const body = (await response.json()) as TrainingPageData;

  if (!response.ok || !body) {
    throw new Error("Training API returned an unexpected response.");
  }

  return body;
}

export async function fetchClubDiagnostic(
  _clubId?: string
): Promise<{ findings: DiagnosticFinding[] } | null> {
  const response = await fetchAuthenticated("/api/club/diagnostics");
  const body = (await response.json()) as { findings: DiagnosticFinding[] } | null;

  if (!response.ok) {
    throw new Error("Diagnostics API returned an unexpected response.");
  }

  return body;
}
export async function fetchWeeklyTrainingIntelligence(
  _clubId?: string
): Promise<WeeklyTrainingIntelligence> {
  const response = await fetchAuthenticated("/api/club/training/intelligence");
  const body = (await response.json()) as WeeklyTrainingIntelligence;

  if (!response.ok || !body) {
    throw new Error("Weekly Training Intelligence API returned an unexpected response.");
  }

  return body;
}

export async function fetchPlayerDevelopment(_clubId?: string): Promise<PlayerDevelopment> {
  const response = await fetchAuthenticated("/api/players/development");
  const body = (await response.json()) as PlayerDevelopment;

  if (!response.ok || !body) {
    throw new Error("Player development API returned an unexpected response.");
  }

  return body;
}

export async function fetchSquadPlanning(_clubId?: string): Promise<SquadPlanningData> {
  const response = await fetchAuthenticated("/api/players/squad-planning");
  const body = (await response.json()) as SquadPlanningData;

  if (!response.ok || !body) {
    throw new Error("Squad Planning API returned an unexpected response.");
  }

  return body;
}

export async function fetchSquadDepthAnalysis(_clubId?: string): Promise<SquadDepthAnalysis> {
  const response = await fetchAuthenticated("/api/players/squad-depth");
  const body = (await response.json()) as SquadDepthAnalysis;

  if (!response.ok || !body) {
    throw new Error("Squad depth API returned an unexpected response.");
  }

  return body;
}

export async function fetchSquadPlanningRecommendations(
  _clubId?: string
): Promise<SquadPlanningRecommendations> {
  const response = await fetchAuthenticated("/api/players/squad-planning-recommendations");
  const body = (await response.json()) as SquadPlanningRecommendations;

  if (!response.ok || !body) {
    throw new Error("Squad planning recommendations API returned an unexpected response.");
  }

  return body;
}

export async function saveSquadRoleAssignment(
  firstArg: string,
  secondArg: string | SquadRole,
  thirdArg?: SquadRole
): Promise<void> {
  const playerId = typeof secondArg === "string" && thirdArg ? secondArg : firstArg;
  const role = typeof secondArg === "string" && thirdArg ? thirdArg : (secondArg as SquadRole);
  const response = await fetchAuthenticated(`/api/players/${playerId}/squad-role`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role })
  });

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, "Unable to save squad role"));
  }
}

export async function resetSquadRoleAssignment(
  firstArg: string,
  secondArg?: string
): Promise<void> {
  const playerId = secondArg ?? firstArg;
  const response = await fetchAuthenticated(`/api/players/${playerId}/squad-role`, {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, "Unable to reset squad role"));
  }
}

async function apiErrorMessage(response: Response, fallback: string): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  const message = errorMessageFromBody(body);

  return message
    ? `${fallback} (${response.status}): ${message}`
    : `${fallback} (${response.status}).`;
}

function errorMessageFromBody(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("importResult" in body)) {
    return null;
  }

  const importResult = body.importResult;
  if (typeof importResult !== "object" || importResult === null || !("errors" in importResult)) {
    return null;
  }

  const errors = importResult.errors;
  if (!Array.isArray(errors) || errors.length === 0) {
    return null;
  }

  const firstError = errors[0];
  return typeof firstError?.message === "string" ? firstError.message : null;
}

export async function fetchPlayerDevelopmentTarget(
  firstArg: string,
  secondArg?: string
): Promise<PlayerDevelopmentTargetOverrideResponse | null> {
  const playerId = secondArg ?? firstArg;
  const response = await fetchAuthenticated(`/api/players/${playerId}/development-target`);

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
  firstArg: string,
  secondArg: string | PlayerDevelopmentTargetOverride,
  thirdArg?: PlayerDevelopmentTargetOverride
): Promise<PlayerDevelopmentTargetOverrideResponse> {
  const playerId = typeof secondArg === "string" && thirdArg ? secondArg : firstArg;
  const override =
    typeof secondArg === "string" && thirdArg
      ? thirdArg
      : (secondArg as PlayerDevelopmentTargetOverride);

  const response = await fetchAuthenticated(`/api/players/${playerId}/development-target`, {
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
  firstArg: string,
  secondArg?: string
): Promise<void> {
  const playerId = secondArg ?? firstArg;
  const response = await fetchAuthenticated(`/api/players/${playerId}/development-target`, {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error("Development target API returned an unexpected response.");
  }
}

export async function fetchYouthPipelinePlanning(_clubId?: string): Promise<YouthPipelinePlanning> {
  const response = await fetchAuthenticated("/api/players/youth-pipeline-planning");
  const body = (await response.json()) as YouthPipelinePlanning;

  if (!response.ok || !body) {
    throw new Error("Youth pipeline planning API returned an unexpected response.");
  }

  return body;
}

export async function fetchYouthDecisionPlanning(_clubId?: string): Promise<YouthDecisionPlanning> {
  const response = await fetchAuthenticated("/api/players/youth-decision-planning");
  const body = (await response.json()) as YouthDecisionPlanning;

  if (!response.ok || !body) {
    throw new Error("Youth decision planning API returned an unexpected response.");
  }

  return body;
}

export async function fetchRealYouthAcademyPlanning(
  _clubId?: string
): Promise<RealYouthAcademyPlanning> {
  const response = await fetchAuthenticated("/api/players/youth-academy");
  const body = (await response.json()) as RealYouthAcademyPlanning;

  if (!response.ok || !body) {
    throw new Error("Real youth academy planning API returned an unexpected response.");
  }

  return body;
}

export async function fetchUserClubs(
  token?: string
): Promise<{ clubs: Array<{ id: string; clubId: number; name: string }> }> {
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetchAuthenticated("/api/user/clubs", { headers });
  if (!response.ok) {
    return { clubs: [] };
  }
  return response.json();
}

export async function syncSokker(
  payload: unknown,
  token?: string
): Promise<{
  response: Response;
  body: ImportResponse;
}> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetchAuthenticated("/api/imports/sokker-sync", {
    method: "POST",
    headers,
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

export async function fetchYouthPerformances(
  _clubId?: string
): Promise<import("@atlas/application").YouthMatchPerformancesDto> {
  const response = await fetchAuthenticated("/api/club/youth/performances");
  const body = await response.json();

  if (!response.ok || !body) {
    throw new Error("Youth performances API returned an unexpected response.");
  }

  return body;
}

export async function patchYouthObservations(
  firstArg: string | number,
  secondArg: number | string,
  thirdArg?: string
): Promise<void> {
  const playerId = typeof secondArg === "number" ? secondArg : Number(firstArg);
  const observations = typeof thirdArg === "string" ? thirdArg : String(secondArg);

  const response = await fetchAuthenticated(`/api/club/youth/players/${playerId}/observations`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ observations })
  });

  if (!response.ok) {
    throw new Error("Failed to update youth observations");
  }
}
