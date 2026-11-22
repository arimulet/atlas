import { getAuthenticatedUserServer, type ServerSessionUser } from "@/lib/session";
import { getActiveClubServer } from "@/lib/server-club";
import type { ActiveClubInfo } from "@/api";

export interface ServerPageContext {
  serverUser: ServerSessionUser | null;
  initialClub: ActiveClubInfo | null;
}

/**
 * Resolves the authenticated session and active club on the server side
 * for Next.js App Router Server Components.
 */
export async function getServerPageContext(): Promise<ServerPageContext> {
  const serverUser = await getAuthenticatedUserServer();

  let initialClub: ActiveClubInfo | null = null;
  if (serverUser?.uid) {
    initialClub = await getActiveClubServer(serverUser);
  } else if (process.env.NODE_ENV !== "production") {
    initialClub = await getActiveClubServer();
  }

  return { serverUser, initialClub };
}
