import { handleApiError, jsonResponse } from "@/lib/api-helper";
import { getAuthenticatedUserServer } from "@/lib/session";
import { getActiveClubServer } from "@/lib/server-club";
import type { ActiveClubInfo } from "@/api";

export interface ActiveClubResponse {
  club: ActiveClubInfo | null;
}

export async function GET() {
  try {
    const user = await getAuthenticatedUserServer();
    const club = await getActiveClubServer(user);
    return jsonResponse<ActiveClubResponse>({ club });
  } catch (error) {
    return handleApiError(error);
  }
}
