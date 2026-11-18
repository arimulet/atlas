import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ read: vi.fn(), findOne: vi.fn(), sort: vi.fn(), lean: vi.fn() }));
vi.mock("../repositories/market-transfer-cache.js", () => ({
  getMarketTransferCache: () => ({ read: mocks.read })
}));
vi.mock("../models/marketTransfer.js", () => ({
  MarketTransferModel: { findOne: mocks.findOne }
}));

import { findLatestFinalMarketTransferByPlayerId } from "../repositories/marketTransferRepository.js";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findOne.mockReturnValue({ sort: mocks.sort });
  mocks.sort.mockReturnValue({ lean: mocks.lean });
});

describe("latest final transfer lookup", () => {
  it("uses the latest matching transfer from the shared cache", async () => {
    const latest = { playerId: 42, transferKey: "latest" };
    mocks.read.mockResolvedValue([{ playerId: 10 }, latest, { playerId: 42, transferKey: "older" }]);

    expect(await findLatestFinalMarketTransferByPlayerId(42)).toEqual(latest);
    expect(mocks.findOne).not.toHaveBeenCalled();
  });

  it("does not query MongoDB when a ready cache has no matching player", async () => {
    mocks.read.mockResolvedValue([]);

    expect(await findLatestFinalMarketTransferByPlayerId(42)).toBeNull();
    expect(mocks.findOne).not.toHaveBeenCalled();
  });

  it("falls back to the indexed MongoDB lookup when cache is unavailable", async () => {
    const latest = { playerId: 42, transferKey: "latest" };
    mocks.read.mockResolvedValue(null);
    mocks.lean.mockResolvedValue(latest);

    expect(await findLatestFinalMarketTransferByPlayerId(42)).toEqual(latest);
    expect(mocks.findOne).toHaveBeenCalledWith({ playerId: 42 });
    expect(mocks.sort).toHaveBeenCalledWith({ transferDate: -1 });
  });
});
