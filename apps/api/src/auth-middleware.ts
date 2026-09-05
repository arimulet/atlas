import type { FastifyRequest, FastifyReply } from "fastify";
import { getUserClubs } from "@atlas/application";
import type { PersistedClub } from "@atlas/database";

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

/**
 * Obtiene el club del usuario autenticado a través del token de sesión.
 * Si el usuario no está autenticado o no tiene club, envía la respuesta de error correspondiente y retorna null.
 */
export async function requireUserClub(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<PersistedClub | null> {
  const authUser = parseAuthUser(request);
  if (!authUser?.uid) {
    reply.code(401).send({
      error: "Unauthorized",
      message: "No se proporcionó un token de autenticación válido."
    });
    return null;
  }

  const clubs = await getUserClubs(authUser.uid);
  if (!clubs || clubs.length === 0) {
    reply.code(404).send({
      error: "NotFound",
      message: "No se encontró ningún club asociado al usuario autenticado."
    });
    return null;
  }

  return clubs[0] ?? null;
}

