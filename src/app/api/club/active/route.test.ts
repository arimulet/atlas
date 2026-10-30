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

import { GET } from "./route";

describe("GET /api/club/active", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null club if user is unauthenticated and no fallback exists", async () => {
    mockEnsureMongoDbConnection.mockResolvedValue(undefined);
    mockGetAuthenticatedUserServer.mockResolvedValue(null);
    mockFindOne.mockResolvedValue(null);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.club).toBeNull();
  });

  it("returns primary club when authenticated user has a club", async () => {
    mockEnsureMongoDbConnection.mockResolvedValue(undefined);
    mockGetAuthenticatedUserServer.mockResolvedValue({ uid: "user-123" });
    mockGetUserClubs.mockResolvedValue([
      {
        id: "club-mongo-id",
        clubId: 6038,
        name: "River Plate",
        country: 15,
        currency: "ARS",
        sokkerUsername: "fueguinoloko",
        gameWeek: 1204,
        week: 7
      }
    ]);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.club).toEqual({
      id: "club-mongo-id",
      clubId: 6038,
      name: "River Plate",
      country: 15,
      currency: "ARS",
      sokkerUsername: "fueguinoloko",
      gameWeek: 1204,
      week: 7
    });
  });

  it("returns fallback club in non-production when authenticated user has no clubs", async () => {
    mockEnsureMongoDbConnection.mockResolvedValue(undefined);
    mockGetAuthenticatedUserServer.mockResolvedValue({ uid: "user-without-clubs" });
    mockGetUserClubs.mockResolvedValue([]);
    mockFindOne.mockResolvedValue({
      _id: "fallback-id",
      clubId: 6038,
      name: "River Plate",
      country: 15,
      currency: "ARS",
      sokkerUsername: "fueguinoloko",
      gameWeek: 1204,
      week: 7
    });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.club?.name).toBe("River Plate");
    expect(data.club?.clubId).toBe(6038);
  });
});
