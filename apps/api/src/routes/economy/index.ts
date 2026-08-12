import { getSquadEconomy, getSquadMarketPlanning } from "@atlas/application";
import { FastifyInstance } from "fastify";
import { GetEconomyParams, GetSquadMarketPlanningParams } from "./types";

async function economyRoutes(server: FastifyInstance) {
  server.get<{ Params: GetEconomyParams }>("/", async (request) => {
    const { clubId } = request.params;

    const economy = await getSquadEconomy(clubId);

    return economy;
  });

  server.get<{ Params: GetSquadMarketPlanningParams }>(
    "/squad-market-planning",
    async (request) => {
      const { clubId } = request.params;

      const marketPlanning = await getSquadMarketPlanning(clubId);

      return marketPlanning;
    }
  );
}

export default economyRoutes;
