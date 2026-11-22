import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnsureMongoDbConnection = vi.fn();
const mockGetAuthenticatedUserServer = vi.fn();
const mockGetUserClubs = vi.fn();
const mockFindOne = vi.fn();

vi.mock("@/lib/api-helper", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-helper")>();
  return {
    ...actual,
    ensureMongoDbConnection: () => mockEnsureMongoDbConnection()
  };
});

vi.mock("@/lib/session", () => ({
  getAuthenticatedUserServer: () => mockGetAuthenticatedUserServer()
}));

vi.mock("@atlas/application", () => ({
  getUserClubs: (...args: unknown[]) => mockGetUserClubs(...args)
}));

vi.mock("@atlas/database", () => ({
  ClubModel: {
    findOne: () => ({
      lean: () => mockFindOne()
    })
  }
}));

import { getActiveClubServer } from "./server-club";

describe("getActiveClubServer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when user is unauthenticated and no dev fallback exists", async () => {
    mockEnsureMongoDbConnection.mockResolvedValue(undefined);
    mockGetAuthenticatedUserServer.mockResolvedValue(null);
    mockFindOne.mockResolvedValue(null);

    const club = await getActiveClubServer();

    expect(club).toBeNull();
  });

  it("returns dev fallback club in non-production when no user is logged in", async () => {
    mockEnsureMongoDbConnection.mockResolvedValue(undefined);
    mockGetAuthenticatedUserServer.mockResolvedValue(null);
    mockFindOne.mockResolvedValue({
      _id: "fallback-id",
      clubId: 9999,
      name: "Fallback FC",
      country: 20,
      currency: "EUR",
      sokkerUsername: "fallback_user",
      gameWeek: 1218,
      week: 80,
      arena: { capacity: 25000 }
    });

    const club = await getActiveClubServer();

    expect(club).toEqual({
      id: "fallback-id",
      clubId: 9999,
      name: "Fallback FC",
      country: 20,
      currency: "EUR",
      sokkerUsername: "fallback_user",
      gameWeek: 1218,
      week: 80,
      arena: { capacity: 25000 }
    });
  });

  it("returns primary club when authenticated user is provided", async () => {
    mockEnsureMongoDbConnection.mockResolvedValue(undefined);
    mockGetUserClubs.mockResolvedValue([
      {
        id: "club-mongo-id",
        clubId: 6038,
        name: "River Plate",
        country: 15,
        currency: "ARS",
        sokkerUsername: "river_manager",
        gameWeek: 1218,
        week: 80,
        arena: null
      }
    ]);

    const club = await getActiveClubServer({ uid: "user-abc" });

    expect(mockGetUserClubs).toHaveBeenCalledWith("user-abc");
    expect(club).toEqual({
      id: "club-mongo-id",
      clubId: 6038,
      name: "River Plate",
      country: 15,
      currency: "ARS",
      sokkerUsername: "river_manager",
      gameWeek: 1218,
      week: 80,
      arena: null
    });
  });
});
