import { ClubModel } from "@atlas/database";
import { getUserClubs } from "@atlas/application";
import type { StadiumData } from "@atlas/domain";
import { ensureMongoDbConnection } from "@/lib/api-helper";
import { getAuthenticatedUserServer, type ServerSessionUser } from "@/lib/session";
import type { ActiveClubInfo } from "@/api";

/**
 * Resolves the active club on the server side using the authenticated user's session
 * or a development fallback when running in non-production mode.
 */
export async function getActiveClubServer(
  userParam?: ServerSessionUser | null
): Promise<ActiveClubInfo | null> {
  await ensureMongoDbConnection().catch(() => null);

  const user = userParam !== undefined ? userParam : await getAuthenticatedUserServer();

  if (!user?.uid) {
    if (process.env.NODE_ENV !== "production") {
      const fallback = await ClubModel.findOne().lean();
      if (fallback) {
        return {
          id: String(fallback._id),
          clubId: fallback.clubId,
          name: fallback.name,
          country: fallback.country,
          currency: fallback.currency,
          sokkerUsername: fallback.sokkerUsername ?? null,
          gameWeek: fallback.gameWeek ?? null,
          week: fallback.week ?? null,
          arena: (fallback.arena as StadiumData | null) ?? null
        };
      }
    }
    return null;
  }

  const clubs = await getUserClubs(user.uid);
  let primary: {
    id: string;
    clubId: number;
    name: string;
    country: number;
    currency: string;
    sokkerUsername?: string | null;
    gameWeek: number | null;
    week: number | null;
    arena?: StadiumData | null;
  } | null = clubs && clubs.length > 0 && clubs[0] ? clubs[0] : null;

  if (!primary && process.env.NODE_ENV !== "production") {
    const fallback = await ClubModel.findOne().lean();
    if (fallback) {
      primary = {
        id: String(fallback._id),
        clubId: fallback.clubId,
        name: fallback.name,
        country: fallback.country,
        currency: fallback.currency,
        sokkerUsername: fallback.sokkerUsername ?? null,
        gameWeek: fallback.gameWeek ?? null,
        week: fallback.week ?? null,
        arena: (fallback.arena as StadiumData | null) ?? null
      };
    }
  }

  if (!primary) {
    return null;
  }

  return {
    id: primary.id,
    clubId: primary.clubId,
    name: primary.name,
    country: primary.country,
    currency: primary.currency,
    sokkerUsername: primary.sokkerUsername ?? null,
    gameWeek: primary.gameWeek,
    week: primary.week,
    arena: primary.arena ?? null
  };
}
