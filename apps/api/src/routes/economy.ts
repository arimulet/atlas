import { getSquadEconomy, getSquadMarketPlanning } from "@atlas/application";
import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { clubParamsSchema } from "../http-schemas";

async function economyRoutes(server: FastifyInstance, options: FastifyPluginOptions) {

server.get("/", async (request) => {
  const { clubId } = clubParamsSchema.parse(request.params);

  return { squadEconomy: await getSquadEconomy({ clubId }) };
});


server.get("/squad-market-planning", async (request) => {
  const { clubId } = clubParamsSchema.parse(request.params);

  return { squadMarketPlanning: await getSquadMarketPlanning({ clubId }) };
});
}

export default economyRoutes;
