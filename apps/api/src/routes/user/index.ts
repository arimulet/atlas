import { getUserClubs } from "@atlas/application";
import { FastifyInstance } from "fastify";
import { parseAuthUser, parseTokenString } from "../../auth-middleware.js";

async function userRoutes(server: FastifyInstance) {
  server.get("/clubs", async (request, reply) => {
    const authUser = parseAuthUser(request);

    if (!authUser?.uid) {
      reply.code(401);
      return {
        error: "Unauthorized",
        message: "No se proporcionó un token de autenticación válido."
      };
    }

    const clubs = await getUserClubs(authUser.uid);
    return { clubs };
  });

  server.post("/session", async (request, reply) => {
    let token: string | null = null;

    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }

    if (!token && typeof request.body === "object" && request.body !== null && "token" in request.body) {
      const bodyToken = (request.body as { token: unknown }).token;
      if (typeof bodyToken === "string") {
        token = bodyToken.trim();
      }
    }

    if (!token) {
      reply.code(400);
      return { error: "BadRequest", message: "Token payload required." };
    }

    const authUser = parseTokenString(token);
    if (!authUser?.uid) {
      reply.code(401);
      return { error: "Unauthorized", message: "Invalid session token." };
    }

    const isProd = process.env.NODE_ENV === "production";
    reply.header(
      "Set-Cookie",
      `__session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${isProd ? "; Secure" : ""}`
    );

    return { status: "ok", user: authUser };
  });

  server.delete("/session", async (_request, reply) => {
    const isProd = process.env.NODE_ENV === "production";
    reply.header(
      "Set-Cookie",
      `__session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProd ? "; Secure" : ""}`
    );

    return { status: "ok" };
  });
}

export default userRoutes;
