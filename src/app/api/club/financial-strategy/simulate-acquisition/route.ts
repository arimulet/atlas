import { NextRequest } from "next/server";
import { z } from "zod";
import { simulatePlayerAcquisitionApplication } from "@atlas/application";
import { getEffectiveClubId, handleApiError, jsonResponse } from "@/lib/api-helper";

const simulateAcquisitionInputSchema = z.object({
  age: z.number().min(15).max(50),
  wage: z.number().min(0),
  estimatedPrice: z.number().min(0),
  observedPosition: z
    .enum(["goalkeeper", "defender", "midfielder", "winger", "striker"])
    .optional()
    .nullable()
});

export async function POST(request: NextRequest) {
  try {
    const clubId = await getEffectiveClubId();
    const rawBody = await request.json();
    const input = simulateAcquisitionInputSchema.parse(rawBody);
    const result = await simulatePlayerAcquisitionApplication(clubId, input);
    return jsonResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
