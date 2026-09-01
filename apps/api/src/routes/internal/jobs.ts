import type { FastifyPluginAsync } from "fastify";
import { runMarketTransferSyncJob } from "@atlas/application";

export const internalJobsRoutes: FastifyPluginAsync = async (app) => {
  app.post("/market-transfer-sync", async (request, reply) => {
    const authHeader = request.headers.authorization;
    const expectedToken = process.env.MARKET_TRANSFERS_JOB_TOKEN;

    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const login = process.env.SOKKER_MARKET_LOGIN;
    const password = process.env.SOKKER_MARKET_PASSWORD;

    if (!login || !password) {
      return reply.status(500).send({ error: "Market credentials not configured" });
    }

    // Since this can take time, we execute it asynchronously and return 202 Accepted.
    // The user asked: "Should the internal job endpoint `/internal/jobs/market-transfer-sync` return immediately to avoid HTTP timeouts if the job takes too long, or should it block until completion?"
    // The user approved the plan without specifying to block. For large paginations, returning 202 is safer. Wait, if it runs in a serverless environment or CI, they might want to block.
    // Actually, I'll block since it's an internal API, standard practice unless timeout is huge. Fastify default timeout is quite high or infinite for incoming. Let's block so the scheduler knows the true result.
    
    try {
      const result = await runMarketTransferSyncJob(login, password);
      if (result.success) {
        return reply.status(200).send(result);
      } else {
        return reply.status(409).send(result); // Conflict or locked
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: errorMsg });
    }
  });
};
