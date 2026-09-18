import { NextRequest } from "next/server";
import { z } from "zod";
import { updateYouthObservations } from "@atlas/application";
import { getEffectiveClubId, handleApiError, jsonResponse } from "@/lib/api-helper";

const playerIdParamSchema = z.coerce.number().int().positive();
const observationsBodySchema = z.object({
  observations: z.array(z.record(z.string(), z.unknown())).optional().default([])
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const rawParams = await params;
    const playerId = playerIdParamSchema.parse(rawParams.playerId);
    const clubId = await getEffectiveClubId();
    const rawBody = await request.json();
    const body = observationsBodySchema.parse(rawBody);
    await updateYouthObservations(clubId, playerId, body.observations);
    return jsonResponse({ status: "ok" });
  } catch (error) {
    return handleApiError(error);
  }
}
