import { NextRequest } from "next/server";
import {
  createSokkerDataProvider,
  loadValidatedSokkerSyncPayload,
  persistSokkerSync
} from "@atlas/application";
import { ensureMongoDbConnection, jsonResponse } from "@/lib/api-helper";
import { getAuthenticatedUserServer } from "@/lib/session";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    await ensureMongoDbConnection();
    const authUser = await getAuthenticatedUserServer();
    if (!authUser) {
      return jsonResponse(
        {
          importResult: {
            status: "rejected",
            errors: [
              {
                path: "session",
                message: "Authentication required to import Sokker data."
              }
            ],
            warnings: [],
            clubId: null,
            importedPlayerCount: 0
          },
          summary: null,
          diagnostic: null
        },
        401
      );
    }
    const body = await request.json();
    const credentials = { login: body.login ?? "", password: body.password ?? "" };
    const provider = createSokkerDataProvider(credentials);
    const validation = await loadValidatedSokkerSyncPayload(provider);

    if (validation.status === "invalid") {
      return jsonResponse({
        importResult: {
          status: "rejected",
          errors: validation.errors.map((issue) => ({
            path: issue.path ?? "sokker-sync",
            message: `[${issue.code}] ${issue.message}`
          })),
          warnings: validation.warnings.map((issue) => ({
            path: issue.path ?? "sokker-sync",
            message: `[${issue.code}] ${issue.message}`
          })),
          clubId: null,
          importedPlayerCount: 0
        },
        summary: null,
        diagnostic: validation.errors.find((issue) => issue.details)?.details ?? null
      });
    }

    const persistence = await persistSokkerSync(validation, {
      ownerUserId: authUser?.uid,
      sokkerUsername: credentials.login
    });

    return jsonResponse({
      importResult: {
        status: validation.warnings.length > 0 ? "accepted-with-warnings" : "accepted",
        errors: [],
        warnings: validation.warnings.map((issue) => ({
          path: issue.path ?? "sokker-sync",
          message: `[${issue.code}] ${issue.message}`
        })),
        importEventId: persistence.syncRunId,
        snapshotId: persistence.snapshotId,
        clubId: persistence.clubId,
        playerIds: [],
        importedPlayerCount: persistence.upserted.players
      },
      summary: null,
      diagnostic: null,
      persistence
    });
  } catch (error) {
    return jsonResponse({
      importResult: {
        status: "rejected",
        errors: [{ path: "api", message: error instanceof Error ? error.message : String(error) }],
        warnings: [],
        clubId: null,
        importedPlayerCount: 0
      },
      summary: null,
      diagnostic: null
    });
  }
}
