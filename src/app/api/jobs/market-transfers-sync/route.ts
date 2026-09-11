import { NextRequest, NextResponse } from "next/server";
import { runMarketTransferSyncJob } from "@atlas/application";
import { connectMongoDb } from "@atlas/database";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // 1. Validar autorización
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.MARKET_TRANSFERS_JOB_TOKEN;

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Validar credenciales de Sokker
  const login = process.env.SOKKER_MARKET_LOGIN;
  const password = process.env.SOKKER_MARKET_PASSWORD;

  if (!login || !password) {
    return NextResponse.json(
      { error: "Market credentials not configured" },
      { status: 500 }
    );
  }

  // 3. Conexión a Base de Datos
  if (process.env.MONGODB_URI) {
    await connectMongoDb(process.env.MONGODB_URI).catch(() => null);
  }

  // 4. Ejecución del Job
  console.log("[MarketTransferSyncRoute] HTTP POST request received. Starting market transfer sync job execution...");
  const startTime = Date.now();
  try {
    const result = await runMarketTransferSyncJob(login, password);
    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
    if (result.success) {
      console.log(`[MarketTransferSyncRoute] Job finished successfully in ${durationSec}s. Status 200 returned.`);
      return NextResponse.json(result, { status: 200 });
    } else {
      console.warn(`[MarketTransferSyncRoute] Job returned unsuccessful (reason: ${JSON.stringify(result.reason)}). Status 409 returned.`);
      return NextResponse.json(result, { status: 409 });
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[MarketTransferSyncRoute] Job thrown uncaught error:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
