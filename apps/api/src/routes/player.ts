import { getPlayerDevelopment, getYouthPipelinePlanning } from "@atlas/application";
import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { clubParamsSchema } from "../http-schemas";


async function playerRoutes(server: FastifyInstance, options: FastifyPluginOptions) {
    
server.get("/development", async (request) => {
  const { clubId } = clubParamsSchema.parse(request.params);

  return { playerDevelopment: await getPlayerDevelopment({ clubId }) };
});


server.get("/youth-pipeline-planning", async (request) => {
  const { clubId } = clubParamsSchema.parse(request.params);

  return { youthPipelinePlanning: await getYouthPipelinePlanning({ clubId }) };
});
}

export default playerRoutes;
