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

      if (typeof decoded.exp === "number" && Date.now() >= decoded.exp * 1000) {
        return null;
      }

      const uid = decoded.user_id || decoded.sub || decoded.uid;
      if (uid && typeof uid === "string") {
        return {
          uid,
          email: typeof decoded.email === "string" ? decoded.email : undefined
        };
      }
    }

    if (process.env.NODE_ENV !== "production" && !trimmed.includes(".")) {
      return { uid: trimmed };
    }

    return null;
  } catch {
    return null;
  }
}

export async function getAuthenticatedUserServer(): Promise<ServerSessionUser | null> {
  try {
    let token: string | undefined;

    try {
      const { headers } = await import("next/headers");
      const headerList = await headers();
      const authHeader = headerList.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7).trim();
      }
    } catch {
      // headers() call may fail outside request context or in unit tests
    }

    if (!token) {
      const cookieStore = await cookies();
      token = cookieStore.get("__session")?.value;
    }

    if (!token) {
      return null;
    }
    return parseTokenString(token);
  } catch {
    return null;
  }
}
