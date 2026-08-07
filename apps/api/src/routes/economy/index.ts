import { getSquadEconomy, getSquadMarketPlanning } from "@atlas/application";
import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { GetEconomyParams, GetSquadMarketPlanningParams } from "./types";

async function economyRoutes(server: FastifyInstance, options: FastifyPluginOptions) {
  server.get<{ Params: GetEconomyParams }>("/", async (request) => {
    const { clubId } = request.params;

    return { squadEconomy: await getSquadEconomy({ clubId }) };
  });

  server.get<{ Params: GetSquadMarketPlanningParams }>("/squad-market-planning", async (request) => {
    const { clubId } = request.params;

    return { squadMarketPlanning: await getSquadMarketPlanning({ clubId }) };
  });
}

export default economyRoutes;
