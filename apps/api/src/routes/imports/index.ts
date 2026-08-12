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
        players: xmlData.players
      };

      const playerResult = await importPlayerSnapshotMvp({ payload: playerSnapshotPayload });

      // Import Juniors
      const youthResult = await importYouthAcademySnapshot({ payload: xmlData.juniors });

      // Merge youth errors/warnings into playerResult so the frontend sees them
      playerResult.importResult.errors.push(...youthResult.errors);
      playerResult.importResult.warnings.push(...youthResult.warnings);

      if (youthResult.status === "rejected") {
        playerResult.importResult.status = "rejected";
      } else if (
        youthResult.status === "accepted-with-warnings" &&
        playerResult.importResult.status === "accepted"
      ) {
        playerResult.importResult.status = "accepted-with-warnings";
      }

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
}

export default importsRoutes;
