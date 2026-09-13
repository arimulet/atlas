import { NextRequest, NextResponse } from "next/server";
import { runMarketTransferSyncJob } from "@atlas/application";
import { getLatestMarketTransferSyncRun } from "@atlas/database";
import { ensureMongoDbConnection } from "@/lib/api-helper";

export const dynamic = "force-dynamic";
// export const maxDuration = 300; // 5 minutos de tiempo máximo de ejecución en Cloud Run

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
    return NextResponse.json({ error: "Market credentials not configured" }, { status: 500 });
  }

  // 3. Conexión a Base de Datos
  await ensureMongoDbConnection().catch((err) => {
    console.error("[MarketTransferSyncRoute] DB connection failed:", err);
  });

  // 4. Ejecución del Job sincrónica (con await para evitar que Cloud Run congele el proceso)
  console.log(
    "[MarketTransferSyncRoute] HTTP POST request received. Starting synchronous execution..."
  );
  const startTime = Date.now();

  try {
    const result = await runMarketTransferSyncJob(login, password);
    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

    if (result.success) {
      console.log(
        `[MarketTransferSyncRoute] Job completed in ${durationSec}s. Status 200 returned.`
      );
      return NextResponse.json({ ...result, durationSec: Number(durationSec) }, { status: 200 });
    } else {
      console.warn(
        `[MarketTransferSyncRoute] Job finished with errors in ${durationSec}s:`,
        result.reason
      );
      return NextResponse.json({ ...result, durationSec: Number(durationSec) }, { status: 409 });
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[MarketTransferSyncRoute] Unexpected error during execution:", err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function GET() {
  await ensureMongoDbConnection().catch((err) => {
    console.error("[MarketTransferSyncRoute GET] DB connection failed:", err);
  });

  try {
    const latestRun = await getLatestMarketTransferSyncRun();
    return NextResponse.json({ latestRun: latestRun ?? null }, { status: 200 });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
