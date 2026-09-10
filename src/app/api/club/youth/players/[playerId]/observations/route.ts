import { NextRequest } from "next/server";
import { updateYouthObservations } from "@atlas/application";
import { getEffectiveClubId, handleApiError, jsonResponse } from "../../../../../../lib/api-helper";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const { playerId } = await params;
    const clubId = await getEffectiveClubId();
    const body = await request.json();
    await updateYouthObservations(clubId, Number(playerId), body?.observations);
    return jsonResponse({ status: "ok" });
  } catch (error) {
    return handleApiError(error);
  }
}
