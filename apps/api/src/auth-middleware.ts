import type { FastifyRequest } from "fastify";

export interface AuthUser {
  uid: string;
  email?: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser | null;
  }
}

/**
 * Extrae y desglosa el usuario autenticado desde el encabezado Authorization: Bearer <token>
 */
export function parseAuthUser(request: FastifyRequest): AuthUser | null {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return null;
  }

  try {
    const parts = token.split(".");
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

    return { uid: token };
  } catch {
    return null;
  }
}
