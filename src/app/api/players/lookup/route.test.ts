import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), createProvider: vi.fn(), getPlayer: vi.fn() }));
vi.mock("@/lib/session", () => ({ getAuthenticatedUserServer: mocks.auth }));
vi.mock("@atlas/application", () => ({ createSokkerDataProvider: mocks.createProvider }));
import { POST } from "./route";

const request = (body: unknown) => new NextRequest("http://localhost/api/players/lookup", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
});

describe("live Sokker player lookup", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("SOKKER_MARKET_LOGIN", "service-user");
    vi.stubEnv("SOKKER_MARKET_PASSWORD", "secret");
    mocks.auth.mockResolvedValue({ uid: "user" });
    mocks.createProvider.mockReturnValue({ getPlayer: mocks.getPlayer });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("looks up the requested player with server credentials", async () => {
    mocks.getPlayer.mockResolvedValue({
      id: 123, name: { fullName: "Player" }, age: 18,
      skills: { stamina: 8, pace: 9, technique: 8, passing: 7, keeper: 1, defending: 5, playmaking: 10, striker: 6 },
      wage: { value: 1000, currency: "u$s" }, value: { value: 30000, currency: "u$s" }
    });
    const response = await POST(request({ playerId: 123 }));
    expect(response.status).toBe(200);
    expect(mocks.createProvider).toHaveBeenCalledWith({ login: "service-user", password: "secret" });
    expect(mocks.getPlayer).toHaveBeenCalledWith(123);
    expect(await response.json()).toMatchObject({ found: true, source: "sokker", player: { playerId: 123, skills: { playmaker: 10 }, wage: 1000, wageCurrency: "u$s", marketValue: 30000, marketValueCurrency: "u$s" } });
  });

  it("does not invent skills that Sokker does not provide", async () => {
    mocks.getPlayer.mockResolvedValue({ id: 123, skills: { stamina: 8 } });
    const response = await POST(request({ playerId: 123 }));
    expect(await response.json()).toMatchObject({ found: false });
  });

  it("preserves zero amounts and leaves missing money unavailable", async () => {
    mocks.getPlayer.mockResolvedValue({
      id: 123, name: { fullName: "Player" }, age: 18,
      skills: { stamina: 8, pace: 9, technique: 8, passing: 7, keeper: 1, defending: 5, playmaking: 10, striker: 6 },
      wage: { value: 0, currency: "u$s" }, value: null
    });
    const response = await POST(request({ playerId: 123 }));
    expect(await response.json()).toMatchObject({ player: { wage: 0, wageCurrency: "u$s", marketValue: null, marketValueCurrency: null } });
  });

  it("does not query Sokker without an authenticated user or valid player ID", async () => {
    mocks.auth.mockResolvedValueOnce(null);
    expect((await POST(request({ playerId: 123 }))).status).toBe(401);
    expect((await POST(request({ playerId: 0 }))).status).toBe(400);
    expect(mocks.createProvider).not.toHaveBeenCalled();
  });

  it("reports missing server credentials without querying Sokker", async () => {
    vi.stubEnv("SOKKER_MARKET_PASSWORD", "");
    expect((await POST(request({ playerId: 123 }))).status).toBe(503);
    expect(mocks.createProvider).not.toHaveBeenCalled();
  });

  it("reports provider failures without exposing credentials", async () => {
    mocks.getPlayer.mockRejectedValue(new Error("secret"));
    const response = await POST(request({ playerId: 123 }));
    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
  });
});
