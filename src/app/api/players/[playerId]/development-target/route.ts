import { NextRequest } from "next/server";
import {
  getPlayerDevelopmentTarget,
  resetPlayerDevelopmentTarget,
  savePlayerDevelopmentTarget
} from "@atlas/application";
import { getEffectiveClubId, handleApiError, jsonResponse } from "../../../../lib/api-helper";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const { playerId } = await params;
    const clubId = await getEffectiveClubId();
    const data = await getPlayerDevelopmentTarget({ clubId, playerId: Number(playerId) });
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
    const { playerId } = await params;
    const clubId = await getEffectiveClubId();
    const body = await request.json();
    const data = await savePlayerDevelopmentTarget({
      clubId,
      playerId: Number(playerId),
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
    const { playerId } = await params;
    const clubId = await getEffectiveClubId();
    await resetPlayerDevelopmentTarget({ clubId, playerId: Number(playerId) });
    return jsonResponse({ status: "ok" });
  } catch (error) {
    return handleApiError(error);
  }
}
