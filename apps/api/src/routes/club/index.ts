import {
  calculateClubHistoricalTrends,
  compareClubSnapshots,
  generateClubHistoricalFindings,
  getClubDashboard,
  getClubOperatingSettings,
  getClubProfile,
  getClubSnapshots,
  updateClubOperatingSettings,
  updateClubProfile
} from "@atlas/application";
import { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  compareClubSnapshotsBodySchema,
  updateClubOperatingSettingsBodySchema,
  updateClubProfileBodySchema
} from "../../http-schemas.js";

import { GetClubDashboardParams, GetClubHistoricalFindingsParams, GetClubHistoricalTrendsParams, GetClubOperatingSettingsParams, GetClubProfileParams, GetClubSnapshotsParams, PatchClubOperatingSettingsParams, PatchClubProfileParams } from "./types.js";

async function clubRoutes(server: FastifyInstance, options: FastifyPluginOptions) {
  server.get<{ Params: GetClubProfileParams }>("/profile", async (request) => {
    const { clubId } = request.params;

    return { club: await getClubProfile({ clubId }) };
  });

  server.get<{ Params: GetClubDashboardParams }>("/dashboard", async (request) => {
    const { clubId } = request.params;

    return { dashboard: await getClubDashboard({ clubId }) };
  });

  server.patch<{ Params: PatchClubProfileParams }>("/profile", async (request) => {
    const { clubId } = request.params;
    const body = updateClubProfileBodySchema.parse(request.body);

    return { club: await updateClubProfile({ clubId, manual: body.manual ?? {} }) };
  });

  server.get<{ Params: GetClubOperatingSettingsParams }>("/operating-settings", async (request) => {
    const { clubId } = request.params;

    return { settings: await getClubOperatingSettings({ clubId }) };
  });

  server.patch<{ Params: PatchClubOperatingSettingsParams }>(
    "/operating-settings",
    async (request) => {
      const { clubId } = request.params;
      const body = updateClubOperatingSettingsBodySchema.parse(request.body);

      return { settings: await updateClubOperatingSettings({ clubId, manual: body.manual ?? {} }) };
    }
  );

  server.get<{ Params: GetClubHistoricalTrendsParams }>("/historical-trends", async (request) => {
    const { clubId } = request.params;

    return calculateClubHistoricalTrends({ clubId });
  });

  server.get<{ Params: GetClubHistoricalFindingsParams }>(
    "/historical-findings",
    async (request) => {
      const { clubId } = request.params;

      return generateClubHistoricalFindings({ clubId });
    }
  );

  server.get<{ Params: GetClubSnapshotsParams }>("/snapshots", async (request) => {
    const { clubId } = request.params;

    return { snapshots: await getClubSnapshots(clubId) };
  });

  server.post<{ Params: GetClubSnapshotsParams }>(
    "/snapshot-comparisons",
    async (request) => {
      const { clubId } = request.params;
      const body = compareClubSnapshotsBodySchema.parse(request.body);

      return compareClubSnapshots({ clubId, ...body });
    }
  );
}

export default clubRoutes;
