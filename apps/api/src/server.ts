import "dotenv/config";
import Fastify from "fastify";
import {
  calculateClubHistoricalTrends,
  compareClubSnapshots,
  generateClubHistoricalFindings,
  importPlayerSnapshotMvp,
  listClubSnapshots,
  validatePlayerSnapshotImport
} from "@atlas/application";
import { connectMongoDb } from "@atlas/database";

export function buildServer() {
  const server = Fastify({ logger: true });

  server.setErrorHandler((error, _request, reply) => {
    server.log.error(error);
    reply.code(500).send({
      importResult: {
        status: "rejected",
        errors: [{ path: "api", message: readErrorMessage(error) }],
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

  server.get("/health", async () => ({ status: "ok", service: "atlas-api" }));

  server.post("/imports/player-snapshot/validate", async (request) => {
    return validatePlayerSnapshotImport({ payload: request.body });
  });

  server.post("/api/imports/player-snapshot", async (request, reply) => {
    const result = await importPlayerSnapshotMvp({ payload: request.body });

    if (result.importResult.status === "rejected") {
      reply.code(422);
    }

    return result;
  });

  server.get("/api/clubs/:clubId/snapshots", async (request) => {
    const { clubId } = request.params as { clubId: string };

    return { snapshots: await listClubSnapshots(clubId) };
  });

  server.post("/api/clubs/:clubId/snapshot-comparisons", async (request) => {
    const { clubId } = request.params as { clubId: string };
    const body = request.body as {
      baseSnapshotId?: string;
      targetSnapshotId?: string;
      baseSnapshotDate?: string;
      targetSnapshotDate?: string;
    };

    return compareClubSnapshots({ clubId, ...body });
  });

  server.get("/api/clubs/:clubId/historical-trends", async (request) => {
    const { clubId } = request.params as { clubId: string };

    return calculateClubHistoricalTrends({ clubId });
  });

  server.get("/api/clubs/:clubId/historical-findings", async (request) => {
    const { clubId } = request.params as { clubId: string };

    return generateClubHistoricalFindings({ clubId });
  });

  return server;
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected import API error.";
}

if (process.env.NODE_ENV !== "test" && process.env.ATLAS_API_AUTOSTART !== "false") {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "127.0.0.1";
  const server = buildServer();

  if (process.env.MONGODB_URI) {
    await connectMongoDb(process.env.MONGODB_URI);
  }

  await server.listen({ port, host });
}
