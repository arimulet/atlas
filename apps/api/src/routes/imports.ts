import { importPlayerSnapshotMvp, validatePlayerSnapshotImport } from "@atlas/application";
import { FastifyInstance, FastifyPluginOptions } from "fastify";

async function importsRoutes(server: FastifyInstance, _: FastifyPluginOptions) {
  server.post("/player-snapshot/validate", async (request) => {
    return validatePlayerSnapshotImport({ payload: request.body });
  });

  server.post("/player-snapshot", async (request, reply) => {
    const result = await importPlayerSnapshotMvp({ payload: request.body });

    if (result.importResult.status === "rejected") {
      reply.code(422);
    }

    return result;
  });
}

export default importsRoutes;
