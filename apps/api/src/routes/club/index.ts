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
} from "@atlas/api/schemas";

import {
  GetClubDashboardParams,
  GetClubHistoricalFindingsParams,
  GetClubHistoricalTrendsParams,
  GetClubOperatingSettingsParams,
  GetClubProfileParams,
  GetClubSnapshotsParams,
  PatchClubOperatingSettingsParams,
  PatchClubProfileParams
} from "./types";

async function clubRoutes(server: FastifyInstance, options: FastifyPluginOptions) {
  server.get<{ Params: GetClubProfileParams }>("/profile", async (request) => {
    const { clubId } = request.params;

    const club = await getClubProfile({ clubId });

    return club;
  });

  server.get<{ Params: GetClubDashboardParams }>("/dashboard", async (request) => {
    const { clubId } = request.params;

    const dashboard = await getClubDashboard({ clubId });

    return dashboard;
  });

  server.patch<{ Params: PatchClubProfileParams }>("/profile", async (request) => {
    const { clubId } = request.params;
    const body = updateClubProfileBodySchema.parse(request.body);

    const profile = await updateClubProfile({ clubId, manual: body.manual ?? {} });

    return profile;
  });

  server.get<{ Params: GetClubOperatingSettingsParams }>("/operating-settings", async (request) => {
    const { clubId } = request.params;

    const operatingSettings = await getClubOperatingSettings({ clubId });
    return operatingSettings;
  });

  server.patch<{ Params: PatchClubOperatingSettingsParams }>(
    "/operating-settings",
    async (request) => {
      const { clubId } = request.params;
      const body = updateClubOperatingSettingsBodySchema.parse(request.body);

      const operatingSettings = await updateClubOperatingSettings({
        clubId,
        manual: body.manual ?? {}
      });

      return operatingSettings;
    }
  );

  server.get<{ Params: GetClubHistoricalTrendsParams }>("/historical-trends", async (request) => {
    const { clubId } = request.params;

    const historicalTrends = await calculateClubHistoricalTrends({ clubId });

    return historicalTrends;
  });

  server.get<{ Params: GetClubHistoricalFindingsParams }>(
    "/historical-findings",
    async (request) => {
      const { clubId } = request.params;

      const historicalFindings = await generateClubHistoricalFindings({ clubId });

      return historicalFindings;
    }
  );

  server.get<{ Params: GetClubSnapshotsParams }>("/snapshots", async (request) => {
    const { clubId } = request.params;

    const snapshots = await getClubSnapshots(clubId);

    return snapshots;
  });

  server.post<{ Params: GetClubSnapshotsParams }>("/snapshot-comparisons", async (request) => {
    const { clubId } = request.params;
    const body = compareClubSnapshotsBodySchema.parse(request.body);

    const snapshotsCompare = await compareClubSnapshots({ clubId, ...body });

    return snapshotsCompare;
  });
}

export default clubRoutes;
