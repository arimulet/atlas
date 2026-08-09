import {
  importPlayerSnapshotMvp,
  importYouthAcademySnapshot,
  validatePlayerSnapshotImport,
  validateYouthAcademySnapshotImport,
  SokkerXmlProvider
} from "@atlas/application";
import { sokkerSyncRequestSchema } from "../../schemas.js";
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

  server.post("/sokker-sync", async (request, reply) => {
    try {
      const credentials = sokkerSyncRequestSchema.parse(request.body);
      const provider = new SokkerXmlProvider();
      
      const xmlData = await provider.importFullTeamData(credentials);

      // Reconstruct payload for player snapshot
      const playerSnapshotPayload = {
        schemaVersion: "atlas.player-snapshot.v0",
        source: {
          type: "sokker-xml-import",
          exportedAt: xmlData.importedAt.toISOString(),
          locale: null
        },
        club: {
          externalId: xmlData.clubProfile.externalId,
          name: xmlData.clubProfile.name
        },
        snapshot: {
          snapshotDate: xmlData.importedAt.toISOString().split("T")[0],
          season: xmlData.clubProfile.season,
          week: xmlData.clubProfile.week
        },
        players: xmlData.players
      };

      const playerResult = await importPlayerSnapshotMvp({ payload: playerSnapshotPayload });
      
      // Import Juniors
      const youthResult = await importYouthAcademySnapshot({ payload: xmlData.juniors });

      return {
        success: true,
        playerResult,
        youthResult
      };
    } catch (error) {
      reply.code(400);
      if (error instanceof Error) {
        return { success: false, error: error.message };
      }
      return { success: false, error: "Unknown error occurred" };
    }
  });
}

export default importsRoutes;
