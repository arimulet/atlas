import { MongoMemoryServer } from "mongodb-memory-server";
import path from "node:path";
import { createServer, type ViteDevServer } from "vite";

export default async function globalSetup() {
  process.env.ATLAS_API_AUTOSTART = "false";
  process.env.ATLAS_API_URL = "http://127.0.0.1:3100";

  const mongo = await MongoMemoryServer.create();
  const { buildServer } = await import("../apps/api/src/server.js");
  const { connectMongoDb, disconnectMongoDb } = await import("../packages/database/src/index.js");
  const api = buildServer();

  await connectMongoDb(mongo.getUri());
  await api.listen({ host: "127.0.0.1", port: 3100 });

  const vite: ViteDevServer = await createServer({
    configFile: path.resolve("apps/web/vite.config.ts"),
    root: path.resolve("apps/web"),
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true
    }
  });

  await vite.listen();

  return async () => {
    await vite.close();
    await api.close();
    await disconnectMongoDb();
    await mongo.stop();
  };
}
