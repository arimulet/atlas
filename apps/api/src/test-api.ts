import { buildServer } from "./server.js";

async function run() {
  const server = buildServer();
  const response = await server.inject({
    method: "GET",
    url: "/api/club/diagnostics",
    headers: {
      Authorization: "Bearer test-user-uid"
    }
  });

  console.log("STATUS:", response.statusCode);
  console.log("BODY:", response.body);
}

run().catch(console.error);
