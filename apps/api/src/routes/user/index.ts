import { getUserClubs } from "@atlas/application";
import { FastifyInstance } from "fastify";
import { parseAuthUser } from "../../auth-middleware.js";

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
}

export default userRoutes;
