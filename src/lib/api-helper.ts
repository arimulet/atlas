import { cache } from "react";
import { NextResponse } from "next/server";
import { connectMongoDb, isMongoConnected } from "@atlas/database";
import { getUserClubs } from "@atlas/application";
import { getAuthenticatedUserServer } from "./session";

export async function ensureMongoDbConnection(): Promise<void> {
  if (isMongoConnected()) {
    return;
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI no está configurada en las variables de entorno.");
  }
  await connectMongoDb(uri);
}

export const getEffectiveClubId = cache(async (): Promise<string> => {
  await ensureMongoDbConnection().catch(() => null);

  try {
    const user = await getAuthenticatedUserServer();
    if (user?.uid) {
      const clubs = await getUserClubs(user.uid);
      if (clubs && clubs.length > 0 && clubs[0]?.id) {
        return String(clubs[0].id);
      }
    }
  } catch {
    // Ignore fallback errors
  }

  return "1";
});

export function jsonResponse<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function handleApiError(error: unknown) {
  return NextResponse.json(
    {
      error: "ApiError",
      message: error instanceof Error ? error.message : "Error al procesar la solicitud"
    },
    { status: 200 }
  );
}
