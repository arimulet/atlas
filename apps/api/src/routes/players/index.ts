import {
  getPlayerDevelopment,
  getRealYouthAcademyPlanning,
  getYouthPipelinePlanning,
  getPlayerDevelopmentTarget,
  resetPlayerDevelopmentTarget,
  savePlayerDevelopmentTarget
} from "@atlas/application";
import { FastifyInstance } from "fastify";
import {
  clubParamsSchema,
  playerDevelopmentTargetBodySchema,
  playerDevelopmentTargetParamsSchema
} from "@atlas/api/schemas";
import { GetDevelopmentParams, GetYouthPipelinePlanningParams } from "./types";

async function playerRoutes(server: FastifyInstance) {
  server.get<{ Params: GetDevelopmentParams & { playerId: number } }>(
    "/:playerId/development-target",
    async (request) => {
      const { clubId, playerId } = playerDevelopmentTargetParamsSchema.parse(request.params);

      return getPlayerDevelopmentTarget({ clubId: Number(clubId), playerId });
    }
  );

  server.put<{ Params: GetDevelopmentParams & { playerId: number } }>(
    "/:playerId/development-target",
    async (request) => {
      const { clubId, playerId } = playerDevelopmentTargetParamsSchema.parse(request.params);
      const body = playerDevelopmentTargetBodySchema.parse(request.body);

      return savePlayerDevelopmentTarget({
        clubId: Number(clubId),
        playerId,
        ...body
      });
    }
  );

  server.delete<{ Params: GetDevelopmentParams & { playerId: number } }>(
    "/:playerId/development-target",
    async (request, reply) => {
      const { clubId, playerId } = playerDevelopmentTargetParamsSchema.parse(request.params);

      await resetPlayerDevelopmentTarget({ clubId: Number(clubId), playerId });
      return reply.code(204).send();
    }
  );

  server.get<{ Params: GetDevelopmentParams }>("/development", async (request) => {
    const { clubId } = clubParamsSchema.parse(request.params);

    const playerDevelopment = await getPlayerDevelopment(clubId);

    return playerDevelopment;
  });

  server.get<{ Params: GetYouthPipelinePlanningParams }>(
    "/youth-pipeline-planning",
    async (request) => {
      const { clubId } = clubParamsSchema.parse(request.params);

      const youthPlanning = await getYouthPipelinePlanning(clubId);

      return youthPlanning;
    }
  );

  server.get<{ Params: GetYouthPipelinePlanningParams }>("/youth-academy", async (request) => {
    const { clubId } = clubParamsSchema.parse(request.params);

    const realYouthPlanning = await getRealYouthAcademyPlanning(clubId);

    return realYouthPlanning;
  });
}

export default playerRoutes;
