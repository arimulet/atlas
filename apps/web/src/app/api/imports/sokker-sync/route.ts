import { NextRequest } from "next/server";
import {
  createSokkerDataProvider,
  loadSokkerSyncPayload,
  validateSokkerSyncPayload,
  persistSokkerSync
} from "@atlas/application";
import { jsonResponse } from "../../../lib/api-helper";
import { getAuthenticatedUserServer } from "../../../lib/session";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const credentials = { login: body.login ?? "", password: body.password ?? "" };
    const authUser = await getAuthenticatedUserServer();
    const provider = createSokkerDataProvider(credentials);
    const loadedPayload = await loadSokkerSyncPayload(provider);
    const validation = validateSokkerSyncPayload(loadedPayload);

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
        diagnostic: null
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
        errors: [
          { path: "api", message: error instanceof Error ? error.message : String(error) }
        ],
        warnings: [],
        clubId: null,
        importedPlayerCount: 0
      },
      summary: null,
      diagnostic: null
    });
  }
}
