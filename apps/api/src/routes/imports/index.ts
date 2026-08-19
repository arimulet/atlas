import {
  createSokkerDataProvider,
  importPlayerSnapshotMvp,
  loadSokkerSyncPayload,
  persistSokkerSync,
  type SokkerSyncValidationIssue,
  validateSokkerSyncPayload,
  validatePlayerSnapshotImport
} from "@atlas/application";
import type { ImportIssue } from "@atlas/contracts";
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
      const loadedPayload = await loadSokkerSyncPayload(provider);
      const validation = validateSokkerSyncPayload(loadedPayload);

      if (validation.status === "invalid") {
        reply.code(422);
        return {
          importResult: {
            status: "rejected" as const,
            errors: mapSyncIssues(validation.errors),
            warnings: mapSyncIssues(validation.warnings),
            clubId: null,
            importedPlayerCount: 0
          },
          summary: null,
          diagnostic: null
        };
      }

      const persistence = await persistSokkerSync(validation);
      return createSyncPersistenceResponse(persistence, validation.warnings);
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

function mapSyncIssues(issues: readonly SokkerSyncValidationIssue[]): ImportIssue[] {
  return issues.map((issue) => ({
    path: issue.path ?? "sokker-sync",
    message: `[${issue.code}] ${issue.message}`
  }));
}

function createSyncPersistenceResponse(
  persistence: Awaited<ReturnType<typeof persistSokkerSync>>,
  warnings: readonly SokkerSyncValidationIssue[]
) {
  return {
    importResult: {
      status: warnings.length > 0 ? ("accepted-with-warnings" as const) : ("accepted" as const),
      errors: [],
      warnings: mapSyncIssues(warnings),
      importEventId: persistence.syncRunId,
      snapshotId: persistence.snapshotId,
      clubId: persistence.clubId,
      playerIds: [],
      importedPlayerCount: persistence.upserted.players
    },
    summary: null,
    diagnostic: null,
    persistence
  };
}

export default importsRoutes;
