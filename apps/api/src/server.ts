import "dotenv/config";
import Fastify from "fastify";
import { ZodError } from "zod";
import { connectMongoDb } from "@atlas/database";
import importsRoutes from "@atlas/api//routes/imports";
import clubRoutes from "@atlas/api//routes/club";
import playerRoutes from "@atlas/api//routes/players";
import economyRoutes from "@atlas/api//routes/economy";
import userRoutes from "@atlas/api//routes/user";
import { clubParamsSchema } from "@atlas/api/schemas";
import { internalJobsRoutes } from "./routes/internal/jobs.js";

export function buildServer() {
  const server = Fastify({ logger: true });

  server.get("/health", async () => ({ status: "ok", service: "atlas-api" }));

  server.register(importsRoutes, { prefix: "/api/imports" });
  server.register(userRoutes, { prefix: "/api/user" });
  server.register(clubRoutes, { prefix: "/api/clubs/:clubId", schema: { params: clubParamsSchema } });
  server.register(playerRoutes, {
    prefix: "/api/clubs/:clubId/players",
    schema: { params: clubParamsSchema }
  });
  server.register(economyRoutes, {
    prefix: "/api/clubs/:clubId/economy",
    schema: { params: clubParamsSchema }
  });
  
  server.register(internalJobsRoutes, { prefix: "/internal/jobs" });

  server.setErrorHandler((error, _request, reply) => {
    server.log.error(error);
    reply.code(error instanceof ZodError ? 400 : 500).send({
      importResult: {
        status: "rejected",
        errors: [
          {
            path: "api",
            message: error instanceof Error ? error.message : "Unexpected import API error."
          }
        ],
        warnings: [],
        importEventId: "",
        snapshotId: null,
        clubId: null,
        playerIds: [],
        importedPlayerCount: 0
      },
      summary: null,
      diagnostic: null
    });
  });

  return server;
}

const server = buildServer();

if (process.env.NODE_ENV !== "test" && process.env.ATLAS_API_AUTOSTART !== "false") {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "127.0.0.1";

  if (process.env.MONGODB_URI) {
    await connectMongoDb(process.env.MONGODB_URI);
  }

  await server.listen({ port, host });
}
