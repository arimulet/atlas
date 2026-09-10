import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockAuth, mockFetch, mockGetIdToken } = vi.hoisted(() => ({
  mockAuth: { currentUser: null as { getIdToken: () => Promise<string> } | null },
  mockFetch: vi.fn(),
  mockGetIdToken: vi.fn()
}));

vi.mock("./services/firebase", () => ({ auth: mockAuth }));

import { fetchClubDashboard, invalidateClientApiCache, saveSquadRoleAssignment } from "./api";

describe("API client authentication", () => {
  beforeEach(() => {
    invalidateClientApiCache();
    mockGetIdToken.mockResolvedValue("session-token");
    mockAuth.currentUser = { getIdToken: mockGetIdToken };
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    invalidateClientApiCache();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("adds the current user token to protected read requests", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ club: {} })));

    await fetchClubDashboard();

    const request = mockFetch.mock.calls[0];
    const headers = request?.[1]?.headers as Headers;

    expect(mockGetIdToken).toHaveBeenCalledOnce();
    expect(request?.[0]).toBe("/api/club/dashboard");
    expect(headers.get("Authorization")).toBe("Bearer session-token");
  });

  it("preserves request headers while adding the current user token to mutations", async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 204 }));

    await saveSquadRoleAssignment("player-1", "core");

    const request = mockFetch.mock.calls[0];
    const options = request?.[1];
    const headers = options?.headers as Headers;

    expect(options?.method).toBe("PUT");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Authorization")).toBe("Bearer session-token");
  });

  it("deduplicates concurrent in-flight GET requests to the same endpoint", async () => {
    mockFetch.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return new Response(JSON.stringify({ club: { id: "club-1" } }));
    });

    // Launch two requests simultaneously
    const [res1, res2] = await Promise.all([fetchClubDashboard(), fetchClubDashboard()]);

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(res1).toEqual({ club: { id: "club-1" } });
    expect(res2).toEqual({ club: { id: "club-1" } });
  });

  it("serves consecutive GET requests from client memory cache within TTL", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ club: { id: "cached-club" } })));

    const first = await fetchClubDashboard();
    const second = await fetchClubDashboard();

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(first).toEqual({ club: { id: "cached-club" } });
    expect(second).toEqual({ club: { id: "cached-club" } });
  });

  it("invalidates cache when a mutation is executed", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ club: { id: "initial" } })))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ club: { id: "updated" } })));

    const initial = await fetchClubDashboard();
    expect(initial).toEqual({ club: { id: "initial" } });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Mutation invalidates cache
    await saveSquadRoleAssignment("player-1", "core");
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Next fetch must hit the network again
    const updated = await fetchClubDashboard();
    expect(updated).toEqual({ club: { id: "updated" } });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
