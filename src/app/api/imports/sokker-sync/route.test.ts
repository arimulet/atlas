import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockEnsureMongoDbConnection = vi.fn();
const mockCreateSokkerDataProvider = vi.fn();
const mockLoadSokkerSyncPayload = vi.fn();
const mockValidateSokkerSyncPayload = vi.fn();
const mockPersistSokkerSync = vi.fn();
const mockGetAuthenticatedUserServer = vi.fn();

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
  createSokkerDataProvider: (...args: unknown[]) => mockCreateSokkerDataProvider(...args),
  loadSokkerSyncPayload: (...args: unknown[]) => mockLoadSokkerSyncPayload(...args),
  validateSokkerSyncPayload: (...args: unknown[]) => mockValidateSokkerSyncPayload(...args),
  persistSokkerSync: (...args: unknown[]) => mockPersistSokkerSync(...args)
}));

import { POST } from "./route";

describe("POST /api/imports/sokker-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls ensureMongoDbConnection before loading and persisting payload", async () => {
    mockEnsureMongoDbConnection.mockResolvedValue(undefined);
    mockGetAuthenticatedUserServer.mockResolvedValue({ uid: "user-1" });
    mockCreateSokkerDataProvider.mockReturnValue({});
    mockLoadSokkerSyncPayload.mockResolvedValue({});
    mockValidateSokkerSyncPayload.mockReturnValue({
      status: "valid",
      warnings: [],
      errors: []
    });
    mockPersistSokkerSync.mockResolvedValue({
      syncRunId: "sync-run-123",
      snapshotId: "snap-123",
      clubId: 10,
      upserted: { players: 18 }
    });

    const req = new NextRequest("http://localhost/api/imports/sokker-sync", {
      method: "POST",
      body: JSON.stringify({ login: "my-user", password: "pwd" })
    });

    const res = await POST(req);
    const json = await res.json();

    expect(mockEnsureMongoDbConnection).toHaveBeenCalledOnce();
    expect(json.importResult.status).toBe("accepted");
    expect(json.importResult.importEventId).toBe("sync-run-123");
    expect(json.importResult.clubId).toBe(10);
  });

  it("returns rejected status with clear api error when DB connection fails", async () => {
    mockEnsureMongoDbConnection.mockRejectedValue(
      new Error("MONGODB_URI no está configurada en las variables de entorno.")
    );

    const req = new NextRequest("http://localhost/api/imports/sokker-sync", {
      method: "POST",
      body: JSON.stringify({ login: "my-user", password: "pwd" })
    });

    const res = await POST(req);
    const json = await res.json();

    expect(json.importResult.status).toBe("rejected");
    expect(json.importResult.errors[0]).toEqual({
      path: "api",
      message: "MONGODB_URI no está configurada en las variables de entorno."
    });
  });
});
