import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetAuthenticatedUserServer = vi.fn();
const mockGetActiveClubServer = vi.fn();

vi.mock("@/lib/session", () => ({
  getAuthenticatedUserServer: () => mockGetAuthenticatedUserServer()
}));

vi.mock("@/lib/server-club", () => ({
  getActiveClubServer: (...args: unknown[]) => mockGetActiveClubServer(...args)
}));

import PlayerDetailPage from "./page";

describe("PlayerDetailPage (SSR)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves session and club for an authenticated user on the server", async () => {
    mockGetAuthenticatedUserServer.mockResolvedValue({ uid: "user-test-1", email: "test@atlas.com" });
    mockGetActiveClubServer.mockResolvedValue({
      id: "club-1",
      clubId: 100,
      name: "Test FC",
      country: 1,
      currency: "USD",
      sokkerUsername: "test_mgr",
      gameWeek: 1200,
      week: 80,
      arena: null
    });

    const params = Promise.resolve({ id: "9876" });
    const element = await PlayerDetailPage({ params });

    expect(mockGetAuthenticatedUserServer).toHaveBeenCalled();
    expect(mockGetActiveClubServer).toHaveBeenCalledWith({ uid: "user-test-1", email: "test@atlas.com" });
    expect(element.props).toEqual(
      expect.objectContaining({
        id: "9876",
        initialServerUser: { uid: "user-test-1", email: "test@atlas.com" },
        initialClub: expect.objectContaining({ name: "Test FC" })
      })
    );
  });

  it("handles unauthenticated user on the server cleanly in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockGetAuthenticatedUserServer.mockResolvedValue(null);

    try {
      const params = Promise.resolve({ id: "5432" });
      const element = await PlayerDetailPage({ params });

      expect(mockGetAuthenticatedUserServer).toHaveBeenCalled();
      expect(element.props).toEqual(
        expect.objectContaining({
          id: "5432",
          initialServerUser: null,
          initialClub: null
        })
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
