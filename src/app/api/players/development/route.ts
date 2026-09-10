import { getPlayerDevelopment } from "@atlas/application";
import { getEffectiveClubId, handleApiError, jsonResponse } from "../../../lib/api-helper";

export async function GET() {
  try {
    const clubId = await getEffectiveClubId();
    const data = await getPlayerDevelopment(clubId);
    return jsonResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}
