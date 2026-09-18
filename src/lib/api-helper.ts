import { cache } from "react";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectMongoDb, isMongoConnected } from "@atlas/database";
import { getUserClubs } from "@atlas/application";
import { getAuthenticatedUserServer } from "./session";

export async function ensureMongoDbConnection(): Promise<void> {
  if (isMongoConnected()) {
    return;
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not configured in environment variables.");
  }
  await connectMongoDb(uri);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const getEffectiveClubId = cache(async (): Promise<string> => {
  await ensureMongoDbConnection().catch(() => null);

  const user = await getAuthenticatedUserServer();
  if (user?.uid) {
    const clubs = await getUserClubs(user.uid);
    if (clubs && clubs.length > 0 && clubs[0]?.id) {
      return String(clubs[0].id);
    }
  }

  throw new ApiError("Unauthorized session or no club associated with user.", 401);
});

export function jsonResponse<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function handleApiError(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: "ValidationError",
        message: "Invalid request payload or parameters",
        issues: error.issues
      },
      { status: 400 }
    );
  }

  const statusCode = error instanceof ApiError ? error.statusCode : 500;
  const message = error instanceof Error ? error.message : "Error processing request";
  return NextResponse.json(
    {
      error: error instanceof ApiError ? error.name : "ApiError",
      message
    },
    { status: statusCode }
  );
}
