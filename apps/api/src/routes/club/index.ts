import {
  calculateClubHistoricalTrends,
  compareClubSnapshots,
  generateClubHistoricalFindings,
  getClubDashboard,
  getClubDiagnostic,
  getFinancialStrategyAssessment,
  getInvestmentSafety,
  getClubOperatingSettings,
  getClubProfile,
  getClubSnapshots,
  getWeeklyTrainingIntelligence,
  getTrainingPageData,
  updateClubOperatingSettings,
  updateClubProfile
} from "@atlas/application";
import { FastifyInstance } from "fastify";
import {
  compareClubSnapshotsBodySchema,
  investmentSafetyBodySchema,
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

async function clubRoutes(server: FastifyInstance) {
  server.get<{ Params: GetClubProfileParams }>("/profile", async (request) => {
    const { clubId } = request.params;

    const club = await getClubProfile(clubId);

    return club;
  });

  server.get<{ Params: GetClubDashboardParams }>("/dashboard", async (request) => {
    const { clubId } = request.params;

    const dashboard = await getClubDashboard(clubId);

    return dashboard;
  });

  server.get<{ Params: GetClubDashboardParams }>("/financial-strategy", async (request) => {
    const { clubId } = request.params;

    return getFinancialStrategyAssessment(clubId);
  });

  server.post<{ Params: GetClubDashboardParams }>(
    "/financial-strategy/investment-safety",
    async (request) => {
      const { clubId } = request.params;
      const { amount } = investmentSafetyBodySchema.parse(request.body);

      return getInvestmentSafety(clubId, amount);
    }
  );

  server.get<{ Params: GetClubDashboardParams }>("/training", async (request) => {
    const { clubId } = request.params;

    return getTrainingPageData(clubId);
  });

  server.get<{ Params: GetClubDashboardParams }>("/diagnostics", async (request) => {
    const { clubId } = request.params;

    return getClubDiagnostic(clubId);
  });
  server.get<{ Params: GetClubDashboardParams }>("/training/intelligence", async (request) => {
    const { clubId } = request.params;

    return getWeeklyTrainingIntelligence(clubId);
  });

  server.patch<{ Params: PatchClubProfileParams }>("/profile", async (request) => {
    const { clubId } = request.params;
    const body = updateClubProfileBodySchema.parse(request.body);

    const profile = await updateClubProfile({ clubId, settings: body.settings ?? {} });

    return profile;
  });

  server.get<{ Params: GetClubOperatingSettingsParams }>("/operating-settings", async (request) => {
    const { clubId } = request.params;

    const operatingSettings = await getClubOperatingSettings(clubId);
    return operatingSettings;
  });

  server.patch<{ Params: PatchClubOperatingSettingsParams }>(
    "/operating-settings",
    async (request) => {
      const { clubId } = request.params;
      const body = updateClubOperatingSettingsBodySchema.parse(request.body);

      const operatingSettings = await updateClubOperatingSettings({
        clubId,
        settings: body.settings ?? {}
      });

      return operatingSettings;
    }
  );

  server.get<{ Params: GetClubHistoricalTrendsParams }>("/historical-trends", async (request) => {
    const { clubId } = request.params;

    const historicalTrends = await calculateClubHistoricalTrends(clubId);

    return historicalTrends;
  });

  server.get<{ Params: GetClubHistoricalFindingsParams }>(
    "/historical-findings",
    async (request) => {
      const { clubId } = request.params;

      const historicalFindings = await generateClubHistoricalFindings(clubId);

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
