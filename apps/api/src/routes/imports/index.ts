import {
  createSokkerDataProvider,
  importPlayerSnapshotMvp,
  importTrainingReports,
  loadSokkerSyncPayload,
  mapCurrentContextToSnapshotClub,
  mapJuniorsToSnapshotJuniors,
  mapPlayersToSnapshotPlayers,
  type SokkerSyncPayload,
  type SokkerSyncValidationIssue,
  validateSokkerSyncPayload,
  validatePlayerSnapshotImport
} from "@atlas/application";
import type { ImportIssue } from "@atlas/contracts";
import type { ImportPlayerSnapshotMvpResult } from "@atlas/application";
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

      const sokkerData = validation.payload;
      const importedAt = new Date();
      const playerResult = await importPlayerSnapshotMvp({
        payload: createPlayerSnapshotPayload(sokkerData, importedAt)
      });
      const result = appendSyncWarnings(playerResult, validation.warnings);

      if (result.importResult.status === "rejected") {
        reply.code(422);
        return result;
      }

      await importTrainingReports(sokkerData.current.team.id, sokkerData.trainingWeeks);
      return result;
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

function appendSyncWarnings(
  result: ImportPlayerSnapshotMvpResult,
  warnings: readonly SokkerSyncValidationIssue[]
): ImportPlayerSnapshotMvpResult {
  if (warnings.length === 0) {
    return result;
  }

  return {
    ...result,
    importResult: {
      ...result.importResult,
      status:
        result.importResult.status === "accepted"
          ? "accepted-with-warnings"
          : result.importResult.status,
      warnings: [...result.importResult.warnings, ...mapSyncIssues(warnings)]
    }
  };
}

function createPlayerSnapshotPayload(data: SokkerSyncPayload, importedAt: Date) {
  return {
    schemaVersion: "atlas.player-snapshot.v0" as const,
    source: {
      type: "sokker-json-api-import" as const,
      exportedAt: importedAt.toISOString(),
      locale: null
    },
    club: mapCurrentContextToSnapshotClub(data.current),
    snapshot: {
      snapshotDate: importedAt.toISOString().split("T")[0]!,
      gameWeek: data.current.calendar.gameWeek,
      week: data.current.calendar.seasonWeek
    },
    players: mapPlayersToSnapshotPlayers(data.players, data.trainingWeeks),
    juniors: mapJuniorsToSnapshotJuniors(data.juniors)
  };
}

export default importsRoutes;
