import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  acquire: vi.fn(),
  finish: vi.fn(),
  rebuild: vi.fn(),
  getCurrent: vi.fn(),
  getTransfers: vi.fn(),
  markMissing: vi.fn(),
  clean: vi.fn(),
  missing: vi.fn(),
  previous: vi.fn(),
  countries: vi.fn()
}));

vi.mock("@atlas/database", () => ({
  acquireMarketTransferSyncRun: mocks.acquire,
  finishMarketTransferSyncRun: mocks.finish,
  rebuildFinalMarketTransfersCache: mocks.rebuild,
  getLastSuccessfulMarketTransferSyncRun: mocks.previous,
  markMissingMarketTransferCurrent: mocks.markMissing,
  cleanupStaleMarketTransferCurrents: mocks.clean,
  getMissingMarketTransfers: mocks.missing,
  MongoCountryRepository: class {
    getAll = mocks.countries;
  },
  bulkUpsertMarketTransferCurrents: vi.fn(),
  deleteMarketTransferCurrent: vi.fn(),
  promoteToFinalMarketTransfer: vi.fn()
}));
vi.mock("../importer/SokkerDataProviderFactory.js", () => ({
  createSokkerDataProvider: () => ({
    getCurrent: mocks.getCurrent,
    getTransfers: mocks.getTransfers
  })
}));

import { runMarketTransferSyncJob } from "../jobs/market-transfer-sync.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.acquire.mockResolvedValue({ runId: "run", success: true });
  mocks.previous.mockResolvedValue(null);
  mocks.countries.mockResolvedValue([]);
  mocks.getCurrent.mockResolvedValue({ calendar: { gameWeek: 100 } });
  mocks.getTransfers.mockResolvedValue([]);
  mocks.markMissing.mockResolvedValue(0);
  mocks.clean.mockResolvedValue(0);
  mocks.missing.mockResolvedValue([]);
  mocks.rebuild.mockResolvedValue(true);
  mocks.finish.mockResolvedValue(undefined);
});

describe("market sync cache rebuild", () => {
  it("rebuilds even when there are no new transfers", async () => {
    const result = await runMarketTransferSyncJob("login", "password");

    expect(result.success).toBe(true);
    expect(mocks.rebuild).toHaveBeenCalledOnce();
    expect(mocks.rebuild.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.finish.mock.invocationCallOrder[0]!
    );
  });

  it("attempts a rebuild when the sync fails after it starts", async () => {
    mocks.getTransfers.mockRejectedValueOnce(new Error("sync failed"));

    const result = await runMarketTransferSyncJob("login", "password");

    expect(result.success).toBe(false);
    expect(mocks.rebuild).toHaveBeenCalledOnce();
    expect(mocks.finish).toHaveBeenCalledWith("run", expect.any(Object), "sync failed");
  });
});
