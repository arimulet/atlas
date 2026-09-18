import { NextRequest } from "next/server";
import { z } from "zod";
import { simulatePlayerAcquisitionApplication } from "@atlas/application";
import { getEffectiveClubId, handleApiError, jsonResponse } from "@/lib/api-helper";

const simulateAcquisitionInputSchema = z
  .object({
    amount: z.number().min(0).optional().nullable(),
    estimatedPrice: z.number().min(0).optional().nullable(),
    weeklyWage: z.number().min(0).optional().nullable(),
    wage: z.number().min(0).optional().nullable(),
    age: z.number().min(15).max(50).optional().nullable(),
    position: z.string().optional().nullable(),
    observedPosition: z.string().optional().nullable(),
    skills: z.record(z.string(), z.number()).optional().nullable(),
    name: z.string().optional().nullable(),
    playerId: z.number().optional().nullable()
  })
  .transform((data) => ({
    amount: data.amount ?? data.estimatedPrice ?? null,
    weeklyWage: data.weeklyWage ?? data.wage ?? null,
    age: data.age ?? null,
    position: data.position ?? data.observedPosition ?? null,
    skills: data.skills ?? {},
    name: data.name ?? null,
    playerId: data.playerId ?? null
  }));

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
