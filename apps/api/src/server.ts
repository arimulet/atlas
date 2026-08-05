import Fastify from "fastify";
import { validatePlayerSnapshotImport } from "@atlas/application";

export function buildServer() {
  const server = Fastify({ logger: true });

  server.get("/health", async () => ({ status: "ok", service: "atlas-api" }));

  server.post("/imports/player-snapshot/validate", async (request) => {
    return validatePlayerSnapshotImport({ payload: request.body });
  });

  return server;
}

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "127.0.0.1";
  const server = buildServer();

  await server.listen({ port, host });
}
