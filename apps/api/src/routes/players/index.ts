import { getPlayerDevelopment, getYouthPipelinePlanning } from "@atlas/application";
import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { clubParamsSchema } from "@atlas/api/schemas";
import { GetDevelopmentParams, GetYouthPipelinePlanningParams } from "./types";

async function playerRoutes(server: FastifyInstance, options: FastifyPluginOptions) {
  server.get<{ Params: GetDevelopmentParams }>("/development", async (request) => {
    const { clubId } = clubParamsSchema.parse(request.params);

    const playerDevelopment = await getPlayerDevelopment({ clubId });

    return playerDevelopment;
  });

  server.get<{ Params: GetYouthPipelinePlanningParams }>(
    "/youth-pipeline-planning",
    async (request) => {
      const { clubId } = clubParamsSchema.parse(request.params);

      const youthPlanning = await getYouthPipelinePlanning({ clubId });

      return youthPlanning;
    }
  );
}

export default playerRoutes;
