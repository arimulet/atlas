import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  MongoPlayerTransferRepository,
  PlayerTransferModel,
  type SavePlayerTransferInput
} from "../src/index.js";

let mongo: MongoMemoryServer;
const transfers = new MongoPlayerTransferRepository();

describe("Mongo player transfer repository", () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  beforeEach(async () => {
    await PlayerTransferModel.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it("persists real sale facts and lists them in date order", async () => {
    const later = await transfers.save(
      buildTransfer({ transferId: "later", transferDate: new Date("2026-08-02") })
    );
    const earlier = await transfers.save(
      buildTransfer({ transferId: "earlier", transferDate: new Date("2026-08-01") })
    );

    const listed = await transfers.findTransfersForCalibration();

    expect(later.id).toEqual(expect.any(String));
    expect(earlier.salePrice).toBe(2_000_000);
    expect(listed.map((transfer) => transfer.transferId)).toEqual(["earlier", "later"]);
    expect(listed[0]).toMatchObject({
      age: 20,
      salePrice: 2_000_000,
      currency: "ARS",
      developmentProfile: "defender",
      salePriceType: "final_sale"
    });
  });

  it("updates a transfer by stable transfer id without duplicating the fact", async () => {
    await transfers.save(buildTransfer({ transferId: "same", salePrice: 1_000_000 }));
    const updated = await transfers.save(
      buildTransfer({ transferId: "same", salePrice: 1_500_000 })
    );

    expect(updated.salePrice).toBe(1_500_000);
    expect(await PlayerTransferModel.countDocuments()).toBe(1);
  });

  it("finds only transfers strictly before a backtest date", async () => {
    await transfers.save(
      buildTransfer({ transferId: "before", transferDate: new Date("2026-01-01") })
    );
    await transfers.save(
      buildTransfer({ transferId: "same-day", transferDate: new Date("2026-02-01") })
    );
    await transfers.save(
      buildTransfer({ transferId: "after", transferDate: new Date("2026-03-01") })
    );

    const found = await transfers.findTransfersBefore(new Date("2026-02-01"));

    expect(found.map((transfer) => transfer.transferId)).toEqual(["before"]);
  });
});

function buildTransfer(overrides: Partial<SavePlayerTransferInput> = {}): SavePlayerTransferInput {
  return {
    transferId: "transfer-1",
    playerId: 100,
    transferDate: new Date("2026-08-01"),
    gameWeek: 1201,
    salePrice: 2_000_000,
    currency: "ARS",
    normalizedSalePrice: null,
    age: 20,
    skills: { defender: 13, pace: 12, technique: 10, playmaker: 9 },
    formation: "DEF",
    developmentProfile: "defender",
    sokkerValue: 1_100_000,
    source: "manual",
    dataQuality: "complete",
    salePriceType: "final_sale",
    ...overrides
  };
}
