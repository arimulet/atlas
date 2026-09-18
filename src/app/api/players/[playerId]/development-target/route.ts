import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getPlayerDevelopmentTarget,
  resetPlayerDevelopmentTarget,
  savePlayerDevelopmentTarget
} from "@atlas/application";
import { getEffectiveClubId, handleApiError, jsonResponse } from "@/lib/api-helper";

const playerIdParamSchema = z.coerce.number().int().positive();
const developmentTargetBodySchema = z.object({
  profile: z.enum(["goalkeeper", "defender", "midfielder", "forward"]),
  targetLevels: z.record(z.string(), z.number()).optional()
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const rawParams = await params;
    const playerId = playerIdParamSchema.parse(rawParams.playerId);
    const clubId = await getEffectiveClubId();
    const data = await getPlayerDevelopmentTarget({ clubId, playerId });
    return jsonResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const rawParams = await params;
    const playerId = playerIdParamSchema.parse(rawParams.playerId);
    const clubId = await getEffectiveClubId();
    const rawBody = await request.json();
    const body = developmentTargetBodySchema.parse(rawBody);
    const data = await savePlayerDevelopmentTarget({
      clubId,
      playerId,
      profile: body.profile,
      targetLevels: body.targetLevels
    });
    return jsonResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const rawParams = await params;
    const playerId = playerIdParamSchema.parse(rawParams.playerId);
    const clubId = await getEffectiveClubId();
    await resetPlayerDevelopmentTarget({ clubId, playerId });
    return jsonResponse({ status: "ok" });
  } catch (error) {
    return handleApiError(error);
  }
}
