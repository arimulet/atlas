import { getSquadEconomy, getSquadMarketPlanning } from "@atlas/application";
import { FastifyInstance } from "fastify";
import { requireUserClub } from "../../auth-middleware.js";

async function economyRoutes(server: FastifyInstance) {
  server.get("/", async (request, reply) => {
    const userClub = await requireUserClub(request, reply);
    if (!userClub) return;

    return getSquadEconomy(userClub.id);
  });

  server.get("/squad-market-planning", async (request, reply) => {
    const userClub = await requireUserClub(request, reply);
    if (!userClub) return;

    return getSquadMarketPlanning(userClub.id);
  });
}

export default economyRoutes;
