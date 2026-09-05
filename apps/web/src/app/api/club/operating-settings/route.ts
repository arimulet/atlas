import { getClubOperatingSettings, updateClubOperatingSettings } from "@atlas/application";
import { getEffectiveClubId, handleApiError, jsonResponse } from "../../../lib/api-helper";
import { NextRequest } from "next/server";

export async function GET() {
  try {
    const clubId = await getEffectiveClubId();
    const data = await getClubOperatingSettings(clubId);
    return jsonResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const clubId = await getEffectiveClubId();
    const body = await request.json();
    const data = await updateClubOperatingSettings({
      clubId,
      settings: body?.settings ?? {}
    });
    return jsonResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}
