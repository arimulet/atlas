import { getClubDiagnostic } from "@atlas/application";
import { getEffectiveClubId, handleApiError, jsonResponse } from "../../../lib/api-helper";

export async function GET() {
  try {
    const clubId = await getEffectiveClubId();
    const data = await getClubDiagnostic(clubId);
    return jsonResponse(data ?? { findings: [] });
  } catch (error) {
    return handleApiError(error);
  }
}
