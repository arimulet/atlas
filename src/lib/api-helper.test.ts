import { beforeEach, describe, expect, it, vi } from "vitest";

const mockConnectMongoDb = vi.fn();
const mockIsMongoConnected = vi.fn();
const mockGetUserClubs = vi.fn();
const mockGetAuthenticatedUserServer = vi.fn();

vi.mock("@atlas/database", () => ({
  connectMongoDb: (...args: unknown[]) => mockConnectMongoDb(...args),
  isMongoConnected: () => mockIsMongoConnected()
}));

vi.mock("@atlas/application", () => ({
  getUserClubs: (...args: unknown[]) => mockGetUserClubs(...args)
}));

vi.mock("./session", () => ({
  getAuthenticatedUserServer: () => mockGetAuthenticatedUserServer()
}));

import { ensureMongoDbConnection } from "./api-helper";

describe("api-helper ensureMongoDbConnection", () => {
  const originalEnv = process.env.MONGODB_URI;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MONGODB_URI = originalEnv;
  });

  it("does not call connectMongoDb if already connected", async () => {
    mockIsMongoConnected.mockReturnValue(true);

    await ensureMongoDbConnection();

    expect(mockConnectMongoDb).not.toHaveBeenCalled();
  });

  it("calls connectMongoDb with MONGODB_URI if disconnected", async () => {
    mockIsMongoConnected.mockReturnValue(false);
    process.env.MONGODB_URI = "mongodb://localhost:27017/test-db";
    mockConnectMongoDb.mockResolvedValue({});

    await ensureMongoDbConnection();

    expect(mockConnectMongoDb).toHaveBeenCalledWith("mongodb://localhost:27017/test-db");
  });

  it("throws clear error if MONGODB_URI is not set and disconnected", async () => {
    mockIsMongoConnected.mockReturnValue(false);
    delete process.env.MONGODB_URI;

    await expect(ensureMongoDbConnection()).rejects.toThrow(
      "MONGODB_URI no está configurada en las variables de entorno."
    );
  });
});
