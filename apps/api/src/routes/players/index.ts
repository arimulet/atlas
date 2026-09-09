import {
  getPlayerDevelopment,
  getSquadDepthAnalysis,
  getSquadPlanningRecommendations,
  getRealYouthAcademyPlanning,
  getSquadAssessment,
  getYouthDecisionPlanning,
  getYouthPipelinePlanning,
  getPlayerDevelopmentTarget,
  getSquadRoleAssignment,
  resetSquadRoleAssignment,
  saveSquadRoleAssignment,
  resetPlayerDevelopmentTarget,
  savePlayerDevelopmentTarget
} from "@atlas/application";
import { FastifyInstance } from "fastify";
import {
  playerDevelopmentTargetBodySchema,
  playerDevelopmentTargetParamsSchema,
  squadRoleAssignmentBodySchema
} from "@atlas/api/schemas";
import { requireUserClub } from "../../auth-middleware.js";

async function playerRoutes(server: FastifyInstance) {
  server.get("/:playerId/development-target", async (request, reply) => {
    const userClub = await requireUserClub(request, reply);
    if (!userClub) return;

    const { playerId } = playerDevelopmentTargetParamsSchema.parse(request.params);
    return getPlayerDevelopmentTarget({ clubId: userClub.id, playerId });
  });

  server.put("/:playerId/development-target", async (request, reply) => {
    const userClub = await requireUserClub(request, reply);
    if (!userClub) return;

    const { playerId } = playerDevelopmentTargetParamsSchema.parse(request.params);
    const body = playerDevelopmentTargetBodySchema.parse(request.body);

    return savePlayerDevelopmentTarget({
      clubId: userClub.id,
      playerId,
      ...body
    });
  });

  server.delete("/:playerId/development-target", async (request, reply) => {
    const userClub = await requireUserClub(request, reply);
    if (!userClub) return;

    const { playerId } = playerDevelopmentTargetParamsSchema.parse(request.params);

    await resetPlayerDevelopmentTarget({ clubId: userClub.id, playerId });
    return reply.code(204).send();
  });

  server.get("/:playerId/squad-role", async (request, reply) => {
    const userClub = await requireUserClub(request, reply);
    if (!userClub) return;

    const { playerId } = playerDevelopmentTargetParamsSchema.parse(request.params);
    return getSquadRoleAssignment({ clubId: userClub.id, playerId });
  });

  server.put("/:playerId/squad-role", async (request, reply) => {
    const userClub = await requireUserClub(request, reply);
    if (!userClub) return;

    const { playerId } = playerDevelopmentTargetParamsSchema.parse(request.params);
    const body = squadRoleAssignmentBodySchema.parse(request.body);
    return saveSquadRoleAssignment({ clubId: userClub.id, playerId, role: body.role });
  });

  server.delete("/:playerId/squad-role", async (request, reply) => {
    const userClub = await requireUserClub(request, reply);
    if (!userClub) return;

    const { playerId } = playerDevelopmentTargetParamsSchema.parse(request.params);
    await resetSquadRoleAssignment({ clubId: userClub.id, playerId });
    return reply.code(204).send();
  });

  server.get("/squad-planning", async (request, reply) => {
    const userClub = await requireUserClub(request, reply);
    if (!userClub) return;

    return getSquadAssessment(userClub.id);
  });

  server.get("/squad-depth", async (request, reply) => {
    const userClub = await requireUserClub(request, reply);
    if (!userClub) return;

    return getSquadDepthAnalysis(userClub.id);
  });

  server.get("/squad-planning-recommendations", async (request, reply) => {
    const userClub = await requireUserClub(request, reply);
    if (!userClub) return;

    return getSquadPlanningRecommendations(userClub.id);
  });

  server.get("/youth-decision-planning", async (request, reply) => {
    const userClub = await requireUserClub(request, reply);
    if (!userClub) return;

    return getYouthDecisionPlanning(userClub.id);
  });

  server.get("/development", async (request, reply) => {
    const userClub = await requireUserClub(request, reply);
    if (!userClub) return;

    return getPlayerDevelopment(userClub.id);
  });

  server.get("/youth-pipeline-planning", async (request, reply) => {
    const userClub = await requireUserClub(request, reply);
    if (!userClub) return;

    return getYouthPipelinePlanning(userClub.id);
  });

  server.get("/youth-academy", async (request, reply) => {
    const userClub = await requireUserClub(request, reply);
    if (!userClub) return;

    return getRealYouthAcademyPlanning(userClub.id);
  });
}

export default playerRoutes;
