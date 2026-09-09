import { NextRequest } from "next/server";
import { getClubProfile, updateClubProfile } from "@atlas/application";
import { getEffectiveClubId, handleApiError, jsonResponse } from "../../../lib/api-helper";

export async function GET() {
  try {
    const clubId = await getEffectiveClubId();
    const data = await getClubProfile(clubId);
    return jsonResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const clubId = await getEffectiveClubId();
    const body = await request.json();
    const data = await updateClubProfile({ clubId, settings: body?.settings ?? {} });
    return jsonResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}
