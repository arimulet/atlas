import { createSokkerDataProvider } from "@atlas/application";
import { inferPositionFromSkills } from "@atlas/domain";
import { jsonResponse } from "@/lib/api-helper";
import { getAuthenticatedUserServer } from "@/lib/session";
import { NextRequest } from "next/server";
import { z } from "zod";

const lookupSchema = z.object({
  playerId: z.number().int().positive()
});

export async function POST(request: NextRequest) {
  if (!(await getAuthenticatedUserServer())) {
    return jsonResponse({ error: "Authentication required." }, 401);
  }
  const parsed = lookupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "Enter a valid player ID." }, 400);

  const login = process.env.SOKKER_MARKET_LOGIN;
  const password = process.env.SOKKER_MARKET_PASSWORD;
  if (!login || !password) {
    return jsonResponse({ error: "Sokker credentials are not configured on the server." }, 503);
  }

  try {
    const { playerId } = parsed.data;
    const player = await createSokkerDataProvider({ login, password }).getPlayer(playerId);
    const raw = player.skills;
    const skills = {
      stamina: raw.stamina, pace: raw.pace, technique: raw.technique, passing: raw.passing,
      keeper: raw.keeper, defender: raw.defending, playmaker: raw.playmaking, striker: raw.striker
    };
    if (Object.values(skills).some((value) => typeof value !== "number" || !Number.isFinite(value))) {
      return jsonResponse({ found: false, message: "Sokker did not provide all skills for this player. Enter the available skills manually." });
    }
    return jsonResponse({
      found: true, source: "sokker",
      player: {
        playerId: player.id, name: player.name.fullName, age: player.age,
        position: inferPositionFromSkills(skills), skills,
        wage: player.wage.value, marketValue: player.value.value
      }
    });
  } catch {
    return jsonResponse({ error: "Unable to retrieve complete player data from Sokker. Check the player ID and whether the player is accessible." }, 502);
  }
}
