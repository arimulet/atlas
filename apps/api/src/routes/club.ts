import {
    calculateClubHistoricalTrends,
  compareClubSnapshots,
  generateClubHistoricalFindings,
  getClubDashboard,
  getClubOperatingSettings,
  getClubProfile,
  getClubSnapshots,
  updateClubOperatingSettings,
  updateClubProfile
} from "@atlas/application";
import { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  clubParamsSchema,
  compareClubSnapshotsBodySchema,
  updateClubOperatingSettingsBodySchema,  
  updateClubProfileBodySchema
} from "../http-schemas";

async function clubRoutes(server: FastifyInstance, options: FastifyPluginOptions) {
  server.get("/profile", async (request) => {
    const { clubId } = clubParamsSchema.parse(request.params);

    return { club: await getClubProfile({ clubId }) };
  });

  server.get("/dashboard", async (request) => {
    const { clubId } = clubParamsSchema.parse(request.params);

    return { dashboard: await getClubDashboard({ clubId }) };
  });

  server.patch("/profile", async (request) => {
    const { clubId } = clubParamsSchema.parse(request.params);
    const body = updateClubProfileBodySchema.parse(request.body);

    return { club: await updateClubProfile({ clubId, manual: body.manual ?? {} }) };
  });

  server.get("/operating-settings", async (request) => {
    const { clubId } = clubParamsSchema.parse(request.params);

    return { settings: await getClubOperatingSettings({ clubId }) };
  });

  server.patch("/operating-settings", async (request) => {
    const { clubId } = clubParamsSchema.parse(request.params);
    const body = updateClubOperatingSettingsBodySchema.parse(request.body);

    return { settings: await updateClubOperatingSettings({ clubId, manual: body.manual ?? {} }) };
  });

  server.get("/historical-trends", async (request) => {
  const { clubId } = clubParamsSchema.parse(request.params);

  return calculateClubHistoricalTrends({ clubId });
});

server.get("/historical-findings", async (request) => {
  const { clubId } = clubParamsSchema.parse(request.params);

  return generateClubHistoricalFindings({ clubId });
});

server.get("/snapshots", async (request) => {
  const { clubId } = clubParamsSchema.parse(request.params);

  return { snapshots: await getClubSnapshots(clubId) };
});


server.post("/snapshot-comparisons", async (request) => {
  const { clubId } = clubParamsSchema.parse(request.params);
  const body = compareClubSnapshotsBodySchema.parse(request.body);

  return compareClubSnapshots({ clubId, ...body });
});

}

export default clubRoutes;
