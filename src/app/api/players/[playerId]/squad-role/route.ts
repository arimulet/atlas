import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getSquadRoleAssignment,
  resetSquadRoleAssignment,
  saveSquadRoleAssignment
} from "@atlas/application";
import { getEffectiveClubId, handleApiError, jsonResponse } from "@/lib/api-helper";

const playerIdParamSchema = z.coerce.number().int().positive();
const squadRoleBodySchema = z.object({
  role: z.enum(["core", "developing", "prospect", "rotation", "depth", "transition"])
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const rawParams = await params;
    const playerId = playerIdParamSchema.parse(rawParams.playerId);
    const clubId = await getEffectiveClubId();
    const data = await getSquadRoleAssignment({ clubId, playerId });
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
    const body = squadRoleBodySchema.parse(rawBody);
    await saveSquadRoleAssignment({
      clubId,
      playerId,
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
    const rawParams = await params;
    const playerId = playerIdParamSchema.parse(rawParams.playerId);
    const clubId = await getEffectiveClubId();
    await resetSquadRoleAssignment({ clubId, playerId });
    return jsonResponse({ status: "ok" });
  } catch (error) {
    return handleApiError(error);
  }
}
