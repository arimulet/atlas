import { getPlayerDevelopment, getYouthPipelinePlanning } from "@atlas/application";
import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { clubParamsSchema } from "../../http-schemas";
import { GetDevelopmentParams, GetYouthPipelinePlanningParams } from "./types";

async function playerRoutes(server: FastifyInstance, options: FastifyPluginOptions) {
  server.get<{ Params: GetDevelopmentParams }>("/development", async (request) => {
    const { clubId } = clubParamsSchema.parse(request.params);

    return { playerDevelopment: await getPlayerDevelopment({ clubId }) };
  });

  server.get<{ Params: GetYouthPipelinePlanningParams }>("/youth-pipeline-planning", async (request) => {
    const { clubId } = clubParamsSchema.parse(request.params);

    return { youthPipelinePlanning: await getYouthPipelinePlanning({ clubId }) };
  });
}

export default playerRoutes;
