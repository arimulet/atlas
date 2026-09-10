import { cookies } from "next/headers";

export interface ServerSessionUser {
  uid: string;
  email?: string;
}

export function parseTokenString(token: string): ServerSessionUser | null {
  const trimmed = token.trim();
  if (!trimmed) return null;

  try {
    const parts = trimmed.split(".");
    if (parts.length === 3 && parts[1]) {
      const payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = Buffer.from(payloadBase64, "base64").toString("utf-8");
      const decoded = JSON.parse(jsonPayload);
      const uid = decoded.user_id || decoded.sub || decoded.uid;
      if (uid && typeof uid === "string") {
        return {
          uid,
          email: typeof decoded.email === "string" ? decoded.email : undefined
        };
      }
    }

    return { uid: trimmed };
  } catch {
    return { uid: trimmed };
  }
}

export async function getAuthenticatedUserServer(): Promise<ServerSessionUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("__session")?.value;
    if (!sessionToken) {
      return null;
    }
    return parseTokenString(sessionToken);
  } catch {
    return null;
  }
}
