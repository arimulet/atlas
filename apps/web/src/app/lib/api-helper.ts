import { NextResponse } from "next/server";
import { connectMongoDb } from "@atlas/database";
import { getUserClubs } from "@atlas/application";
import { getAuthenticatedUserServer } from "./session";

export async function getEffectiveClubId(): Promise<string> {
  if (process.env.MONGODB_URI) {
    await connectMongoDb(process.env.MONGODB_URI).catch(() => null);
  }

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
}

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
