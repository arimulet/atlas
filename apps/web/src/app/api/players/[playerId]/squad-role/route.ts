import { NextRequest } from "next/server";
import {
  getSquadRoleAssignment,
  resetSquadRoleAssignment,
  saveSquadRoleAssignment
} from "@atlas/application";
import { getEffectiveClubId, handleApiError, jsonResponse } from "../../../../lib/api-helper";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const { playerId } = await params;
    const clubId = await getEffectiveClubId();
    const data = await getSquadRoleAssignment({ clubId, playerId: Number(playerId) });
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
    await saveSquadRoleAssignment({
      clubId,
      playerId: Number(playerId),
      role: body.role
    });
    return jsonResponse({ status: "ok" });
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
    await resetSquadRoleAssignment({ clubId, playerId: Number(playerId) });
    return jsonResponse({ status: "ok" });
  } catch (error) {
    return handleApiError(error);
  }
}
