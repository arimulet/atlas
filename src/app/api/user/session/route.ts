import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  let token: string | null = null;
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  }

  if (!token) {
    try {
      const body = await request.json();
      if (body && typeof body.token === "string") {
        token = body.token.trim();
      }
    } catch {
      // Ignore body parsing errors
    }
  }

  const isProd = process.env.NODE_ENV === "production";
  const response = NextResponse.json({ status: "ok" });
  if (token) {
    response.cookies.set("__session", token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: isProd
    });
  }
  return response;
}

export async function DELETE() {
  const isProd = process.env.NODE_ENV === "production";
  const response = NextResponse.json({ status: "ok" });
  response.cookies.set("__session", "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: 0
  });
  return response;
}
