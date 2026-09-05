import { NextRequest } from "next/server";
import { compareClubSnapshots } from "@atlas/application";
import { getEffectiveClubId, handleApiError, jsonResponse } from "../../../lib/api-helper";

export async function POST(request: NextRequest) {
  try {
    const clubId = await getEffectiveClubId();
    const body = await request.json();
    const result = await compareClubSnapshots({ clubId, ...body });
    return jsonResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
