import {
  importPlayerSnapshotMvp,
  importYouthAcademySnapshot,
  validatePlayerSnapshotImport,
  validateYouthAcademySnapshotImport
} from "@atlas/application";
import { FastifyInstance } from "fastify";

async function importsRoutes(server: FastifyInstance) {
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

  server.post("/youth-academy/validate", async (request) => {
    return validateYouthAcademySnapshotImport({ payload: request.body });
  });

  server.post("/youth-academy", async (request, reply) => {
    const result = await importYouthAcademySnapshot({ payload: request.body });

    if (result.status === "rejected") {
      reply.code(422);
    }

    return result;
  });
}

export default importsRoutes;
