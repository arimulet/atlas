import {
  createSokkerDataProvider,
  assembleSokkerTeamData,
  importPlayerSnapshotMvp,
  importTrainingReports,
  type SokkerImportResultDto,
  validatePlayerSnapshotImport
} from "@atlas/application";
import { FastifyInstance } from "fastify";
import { sokkerSyncRequestSchema } from "../../schemas.js";

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
      const provider = createSokkerDataProvider(credentials);
      const sokkerData = await assembleSokkerTeamData(provider);
      const playerResult = await importPlayerSnapshotMvp({
        payload: createPlayerSnapshotPayload(sokkerData)
      });

      if (playerResult.importResult.status === "rejected") {
        reply.code(422);
        return playerResult;
      }

      await importTrainingReports(
        Number(sokkerData.clubProfile.externalId),
        sokkerData.training ?? []
      );
      return playerResult;
    } catch (error) {
      reply.code(422);

      return {
        importResult: {
          status: "rejected" as const,
          errors: [
            { path: "api", message: error instanceof Error ? error.message : String(error) }
          ],
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

function createPlayerSnapshotPayload(data: SokkerImportResultDto) {
  return {
    schemaVersion: "atlas.player-snapshot.v0" as const,
    source: {
      type: "sokker-json-api-import" as const,
      exportedAt: data.importedAt.toISOString(),
      locale: null
    },
    club: {
      clubId: Number(data.clubProfile.externalId),
      country: data.clubProfile.countryId,
      name: data.clubProfile.name,
      training: data.clubProfile.training,
      gameWeek: data.clubProfile.gameWeek
    },
    snapshot: {
      snapshotDate: data.importedAt.toISOString().split("T")[0]!,
      gameWeek: data.clubProfile.gameWeek,
      week: data.clubProfile.week
    },
    players: data.players,
    juniors: data.juniors
  };
}

export default importsRoutes;
