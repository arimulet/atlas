import { getInvestmentSafety } from "@atlas/application";
import { getEffectiveClubId, handleApiError, jsonResponse } from "../../../../lib/api-helper";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const clubId = await getEffectiveClubId();
    const body = await request.json();
    const amount = Number(body?.amount ?? 0);
    const data = await getInvestmentSafety(clubId, amount);
    return jsonResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}
