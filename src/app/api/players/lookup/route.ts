import { PlayerModel } from "@/database/models/player";
import { MarketTransferCurrentModel } from "@/database/models/marketTransferCurrent";
import { MarketTransferModel } from "@/database/models/marketTransfer";
import { ensureMongoDbConnection, handleApiError, jsonResponse } from "@/lib/api-helper";
import { inferPositionFromSkills } from "@atlas/domain";
import { NextRequest } from "next/server";

function normalizeSkills(raw: Record<string, number | null | undefined>): Record<string, number> {
  const normalized: Record<string, number> = {
    stamina: raw.stamina ?? 0,
    pace: raw.pace ?? 0,
    technique: raw.technique ?? 0,
    passing: raw.passing ?? 0,
    keeper: raw.keeper ?? 0,
    defender: raw.defender ?? (raw as Record<string, number>).defending ?? 0,
    playmaker: raw.playmaker ?? (raw as Record<string, number>).playmaking ?? 0,
    striker: raw.striker ?? (raw as Record<string, number>).scoring ?? 0
  };
  if (typeof raw.form === "number") {
    normalized.form = raw.form;
  }
  return normalized;
}

export async function GET(request: NextRequest) {
  try {
    await ensureMongoDbConnection();
    const { searchParams } = new URL(request.url);
    const playerIdRaw = searchParams.get("playerId");
    const playerId = Number(playerIdRaw);

    if (!playerIdRaw || !Number.isFinite(playerId) || playerId <= 0) {
      return jsonResponse({ error: "Invalid playerId provided." }, 400);
    }

    // 1. Buscar en PlayerModel
    const playerDoc = await PlayerModel.findOne({ playerId }).lean();
    if (playerDoc) {
      const skills = normalizeSkills((playerDoc.skills as Record<string, number>) ?? {});
      return jsonResponse({
        found: true,
        source: "club_player",
        player: {
          playerId: playerDoc.playerId,
          name: playerDoc.name,
          age: playerDoc.age ?? null,
          position: playerDoc.position ?? inferPositionFromSkills(skills),
          skills,
          wage: playerDoc.wage ?? null,
          marketValue: playerDoc.marketValue ?? null
        }
      });
    }

    // 2. Buscar en MarketTransferCurrentModel (mercado de transferencias activo)
    const transferDoc = await MarketTransferCurrentModel.findOne({ playerId }).lean();
    if (transferDoc) {
      const skills = normalizeSkills((transferDoc.player.skills as Record<string, number>) ?? {});
      const position = inferPositionFromSkills(skills);
      return jsonResponse({
        found: true,
        source: "transfer_market",
        player: {
          playerId: transferDoc.playerId,
          name: transferDoc.player.name,
          age: transferDoc.player.age ?? null,
          position,
          skills,
          wage: null,
          marketValue: null
        }
      });
    }

    // 3. Buscar en MarketTransferModel (transferencias históricas cerradas)
    const historicalDoc = await MarketTransferModel.findOne({ playerId }).sort({ transferDate: -1 }).lean();
    if (historicalDoc) {
      const skills = normalizeSkills((historicalDoc.skills as Record<string, number>) ?? {});
      const position = inferPositionFromSkills(skills);
      return jsonResponse({
        found: true,
        source: "market_transfer_history",
        player: {
          playerId: historicalDoc.playerId,
          name: historicalDoc.name,
          age: historicalDoc.age ?? null,
          position,
          skills,
          wage: null,
          marketValue: historicalDoc.salePrice ?? null
        }
      });
    }

    return jsonResponse({
      found: false,
      message: "Player not found in local records. You can enter their skills in the Manual Skill Entry tab."
    });
  } catch (error) {
    return handleApiError(error);
  }
}
