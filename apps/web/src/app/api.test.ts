import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockAuth, mockFetch, mockGetIdToken } = vi.hoisted(() => ({
  mockAuth: { currentUser: null as { getIdToken: () => Promise<string> } | null },
  mockFetch: vi.fn(),
  mockGetIdToken: vi.fn()
}));

vi.mock("./services/firebase", () => ({ auth: mockAuth }));

import { fetchClubDashboard, saveSquadRoleAssignment } from "./api";

describe("API client authentication", () => {
  beforeEach(() => {
    mockGetIdToken.mockResolvedValue("session-token");
    mockAuth.currentUser = { getIdToken: mockGetIdToken };
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
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
});
