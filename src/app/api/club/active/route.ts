import { ClubModel } from "@atlas/database";
import { getUserClubs } from "@atlas/application";
import { ensureMongoDbConnection, handleApiError, jsonResponse } from "@/lib/api-helper";
import { getAuthenticatedUserServer } from "@/lib/session";

export interface ActiveClubResponse {
  club: {
    id: string;
    clubId: number;
    name: string;
    country: number;
    currency: string;
    sokkerUsername: string | null;
    gameWeek: number | null;
    week: number | null;
  } | null;
}

export async function GET() {
  try {
    await ensureMongoDbConnection().catch(() => null);

    const user = await getAuthenticatedUserServer();
    if (!user?.uid) {
      // In dev mode, allow reading the first club if available
      if (process.env.NODE_ENV !== "production") {
        const fallback = await ClubModel.findOne().lean();
        if (fallback) {
          return jsonResponse<ActiveClubResponse>({
            club: {
              id: String(fallback._id),
              clubId: fallback.clubId,
              name: fallback.name,
              country: fallback.country,
              currency: fallback.currency,
              sokkerUsername: fallback.sokkerUsername ?? null,
              gameWeek: fallback.gameWeek ?? null,
              week: fallback.week ?? null
            }
          });
        }
      }
      return jsonResponse<ActiveClubResponse>({ club: null });
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
          week: fallback.week ?? null
        };
      }
    }

    if (!primary) {
      return jsonResponse<ActiveClubResponse>({ club: null });
    }

    return jsonResponse<ActiveClubResponse>({
      club: {
        id: primary.id,
        clubId: primary.clubId,
        name: primary.name,
        country: primary.country,
        currency: primary.currency,
        sokkerUsername: primary.sokkerUsername ?? null,
        gameWeek: primary.gameWeek,
        week: primary.week
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
