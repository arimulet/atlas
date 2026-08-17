import {
  createSokkerDataProvider,
  importTrainingReports,
  importPlayerSnapshotMvp,
  validatePlayerSnapshotImport
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

  server.post("/sokker-sync", async (request, reply) => {
    try {
      const credentials = sokkerSyncRequestSchema.parse(request.body);
      const provider = createSokkerDataProvider({ source: "xml", credentials });
      const xmlData = await provider.getFullTeamData();

      // Reconstruct payload for player snapshot
      const playerSnapshotPayload = {
        schemaVersion: "atlas.player-snapshot.v0",
        source: {
          type: "sokker-xml-import",
          exportedAt: xmlData.importedAt.toISOString(),
          locale: null
        },
        club: {
          clubId: Number(xmlData.clubProfile.externalId),
          country: xmlData.clubProfile.countryId,
          name: xmlData.clubProfile.name,
          training: xmlData.clubProfile.training,
          gameWeek: xmlData.clubProfile.gameWeek
        },
        snapshot: {
          snapshotDate: xmlData.importedAt.toISOString().split("T")[0],
          gameWeek: xmlData.clubProfile.gameWeek,
          week: xmlData.clubProfile.week
        },
        players: xmlData.players,
        juniors: xmlData.juniors
      };

      const playerResult = await importPlayerSnapshotMvp({ payload: playerSnapshotPayload });

      if (playerResult.importResult.status === "rejected") {
        reply.code(422);
      }

      return playerResult;
    } catch (error) {
      reply.code(422);

      let message = error instanceof Error ? error.message : String(error);
      if (
        error &&
        typeof error === "object" &&
        "format" in error &&
        typeof (error as { format: unknown }).format === "function"
      ) {
        // It's a Zod error, let's make it readable
        const e = error as unknown as {
          issues: Array<{ path: (string | number)[]; message: string }>;
        };
        message =
          "XML Validation Error: " +
          e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
      }

      return {
        importResult: {
          status: "rejected",
          errors: [{ path: "api", message }],
          warnings: [],
          clubId: null,
          importedPlayerCount: 0
        },
        summary: null,
        diagnostic: null
      };
    }
  });

  server.post("/sokker-json-sync", async (request, reply) => {
    try {
      const credentials = sokkerSyncRequestSchema.parse(request.body);
      const provider = createSokkerDataProvider({ source: "json-api", credentials });
      const apiData = await provider.getFullTeamData();
      const playerSnapshotPayload = {
        schemaVersion: "atlas.player-snapshot.v0",
        source: {
          type: "sokker-json-api-import",
          exportedAt: apiData.importedAt.toISOString(),
          locale: null
        },
        club: {
          clubId: Number(apiData.clubProfile.externalId),
          country: apiData.clubProfile.countryId,
          name: apiData.clubProfile.name,
          training: apiData.clubProfile.training,
          gameWeek: apiData.clubProfile.gameWeek
        },
        snapshot: {
          snapshotDate: apiData.importedAt.toISOString().split("T")[0],
          gameWeek: apiData.clubProfile.gameWeek,
          week: apiData.clubProfile.week
        },
        players: apiData.players,
        juniors: apiData.juniors
      };
      const playerResult = await importPlayerSnapshotMvp({ payload: playerSnapshotPayload });

      if (playerResult.importResult.status === "rejected") {
        reply.code(422);
        return playerResult;
      }

      await importTrainingReports(Number(apiData.clubProfile.externalId), apiData.training ?? []);
      return playerResult;
    } catch (error) {
      reply.code(422);
      return {
        importResult: {
          status: "rejected",
          errors: [{ path: "api", message: error instanceof Error ? error.message : String(error) }],
          warnings: [],
          clubId: null,
          importedPlayerCount: 0
        },
        summary: null,
        diagnostic: null
      };
    }
  });

}

export default importsRoutes;
