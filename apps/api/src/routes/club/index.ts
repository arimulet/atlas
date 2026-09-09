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
  updateClubProfile,
  getYouthPerformances,
  updateYouthObservations
} from "@atlas/application";
import { FastifyInstance } from "fastify";
import {
  compareClubSnapshotsBodySchema,
  investmentSafetyBodySchema,
  updateClubOperatingSettingsBodySchema,
  updateClubProfileBodySchema,
  patchYouthObservationsBodySchema
} from "@atlas/api/schemas";
import { requireUserClub } from "../../auth-middleware.js";

async function clubRoutes(server: FastifyInstance) {
  server.get("/profile", async (request, reply) => {
    const userClub = await requireUserClub(request, reply);
    if (!userClub) return;

    return getClubProfile(userClub.id);
  });

  server.get("/dashboard", async (request, reply) => {
    const userClub = await requireUserClub(request, reply);
    if (!userClub) return;

    return getClubDashboard(userClub.id);
  });

  server.get("/financial-strategy", async (request, reply) => {
    const userClub = await requireUserClub(request, reply);
    if (!userClub) return;

    return getFinancialStrategyAssessment(userClub.id);
  });

  server.post("/financial-strategy/investment-safety", async (request, reply) => {
    const userClub = await requireUserClub(request, reply);
    if (!userClub) return;

    const { amount } = investmentSafetyBodySchema.parse(request.body);
    return getInvestmentSafety(userClub.id, amount);
  });

  server.get("/training", async (request, reply) => {
    const userClub = await requireUserClub(request, reply);
    if (!userClub) return;

    return getTrainingPageData(userClub.id);
  });

  server.get("/diagnostics", async (request, reply) => {
    const userClub = await requireUserClub(request, reply);
    if (!userClub) return;

    return getClubDiagnostic(userClub.id);
  });

  server.get("/training/intelligence", async (request, reply) => {
    const userClub = await requireUserClub(request, reply);
    if (!userClub) return;

    return getWeeklyTrainingIntelligence(userClub.id);
  });

  server.patch("/profile", async (request, reply) => {
    const userClub = await requireUserClub(request, reply);
    if (!userClub) return;

    const body = updateClubProfileBodySchema.parse(request.body);
    return updateClubProfile({ clubId: userClub.id, settings: body.settings ?? {} });
  });

  server.get("/operating-settings", async (request, reply) => {
    const userClub = await requireUserClub(request, reply);
    if (!userClub) return;

    return getClubOperatingSettings(userClub.id);
  });

  server.patch("/operating-settings", async (request, reply) => {
    const userClub = await requireUserClub(request, reply);
    if (!userClub) return;

    const body = updateClubOperatingSettingsBodySchema.parse(request.body);
    return updateClubOperatingSettings({
      clubId: userClub.id,
      settings: body.settings ?? {}
    });
  });

  server.get("/historical-trends", async (request, reply) => {
    const userClub = await requireUserClub(request, reply);
    if (!userClub) return;

    return calculateClubHistoricalTrends(userClub.id);
  });

  server.get("/historical-findings", async (request, reply) => {
    const userClub = await requireUserClub(request, reply);
    if (!userClub) return;

    return generateClubHistoricalFindings(userClub.id);
  });

  server.get("/snapshots", async (request, reply) => {
    const userClub = await requireUserClub(request, reply);
    if (!userClub) return;

    return getClubSnapshots(userClub.id);
  });

  server.post("/snapshot-comparisons", async (request, reply) => {
    const userClub = await requireUserClub(request, reply);
    if (!userClub) return;

    const body = compareClubSnapshotsBodySchema.parse(request.body);
    return compareClubSnapshots({ clubId: userClub.id, ...body });
  });

  server.get("/youth/performances", async (request, reply) => {
    const userClub = await requireUserClub(request, reply);
    if (!userClub) return;

    return getYouthPerformances(userClub.id);
  });

  server.patch<{ Params: { playerId: string } }>(
    "/youth/players/:playerId/observations",
    async (request, reply) => {
      const userClub = await requireUserClub(request, reply);
      if (!userClub) return;

      const { playerId } = request.params;
      const { observations } = patchYouthObservationsBodySchema.parse(request.body);

      await updateYouthObservations(userClub.id, Number(playerId), observations);
      return reply.status(204).send();
    }
  );
}

export default clubRoutes;
