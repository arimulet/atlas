import { getUserClubs } from "@atlas/application";
import { getAuthenticatedUserServer } from "../../../lib/session";
import { handleApiError, jsonResponse } from "../../../lib/api-helper";

export async function GET() {
  try {
    const user = await getAuthenticatedUserServer();
    if (!user?.uid) {
      return jsonResponse({ clubs: [] });
    }
    const clubs = await getUserClubs(user.uid);
    return jsonResponse({ clubs: clubs ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}
