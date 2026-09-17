import { describe, expect, it, vi } from "vitest";
import { parseTokenString } from "./session";

describe("parseTokenString", () => {
  it("returns null for empty token string", () => {
    expect(parseTokenString("")).toBeNull();
    expect(parseTokenString("   ")).toBeNull();
  });

  it("parses valid JWT token with user_id payload", () => {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64");
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const payload = Buffer.from(
      JSON.stringify({ user_id: "user_123", email: "user@example.com", exp })
    ).toString("base64");
    const token = `${header}.${payload}.signature`;

    const result = parseTokenString(token);
    expect(result).toEqual({ uid: "user_123", email: "user@example.com" });
  });

  it("rejects expired JWT token", () => {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64");
    const exp = Math.floor(Date.now() / 1000) - 3600; // 1 hour in the past
    const payload = Buffer.from(JSON.stringify({ sub: "user_456", exp })).toString("base64");
    const token = `${header}.${payload}.signature`;

    expect(parseTokenString(token)).toBeNull();
  });

  it("rejects malformed token strings in production", () => {
    vi.stubEnv("NODE_ENV", "production");

    try {
      expect(parseTokenString("invalid-plain-text")).toBeNull();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
