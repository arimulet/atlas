import { simulatePlayerAcquisitionApplication } from "@atlas/application";
import { getEffectiveClubId, handleApiError, jsonResponse } from "@/lib/api-helper";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const clubId = await getEffectiveClubId();
    const body = await request.json();
    const result = await simulatePlayerAcquisitionApplication(clubId, body);
    return jsonResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
