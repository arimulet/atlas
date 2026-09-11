import { NextRequest, NextResponse } from "next/server";
import { runMarketTransferSyncJob } from "@atlas/application";
import { connectMongoDb, getLatestMarketTransferSyncRun } from "@atlas/database";

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

  // 4. Ejecución del Job en segundo plano (Asíncrono)
  console.log("[MarketTransferSyncRoute] HTTP POST request received. Triggering background execution...");

  runMarketTransferSyncJob(login, password).catch((err) => {
    console.error("[MarketTransferSyncRoute] Error during background execution:", err);
  });

  return NextResponse.json(
    { message: "Market transfer sync job started in background" },
    { status: 202 }
  );
}

export async function GET() {
  if (process.env.MONGODB_URI) {
    await connectMongoDb(process.env.MONGODB_URI).catch(() => null);
  }

  try {
    const latestRun = await getLatestMarketTransferSyncRun();
    return NextResponse.json({ latestRun: latestRun ?? null }, { status: 200 });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
