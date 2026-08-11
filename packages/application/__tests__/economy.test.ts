import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ClubModel, ImportEventModel, PlayerModel, SnapshotModel } from "@atlas/database";
import { getSquadEconomy } from "../src/economy/index.js";
import { importPlayerSnapshot } from "../src/playerImport/index.js";
import { updateClubOperatingSettings } from "../src/clubOperatingSettings/index.js";

let mongo: MongoMemoryServer;

const validSnapshotPath = path.resolve(
  __dirname,
  "../../test-fixtures/fixtures/player-snapshot/valid.json"
);

describe("Squad economy use case", () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  beforeEach(async () => {
    await Promise.all([
      ClubModel.deleteMany({}),
      ImportEventModel.deleteMany({}),
      PlayerModel.deleteMany({}),
      SnapshotModel.deleteMany({})
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it("returns Economia de plantilla from the latest snapshot and effective risk settings", async () => {
    const importResult = await importPlayerSnapshot({ payload: readValidSnapshot() });

    await updateClubOperatingSettings({
      clubId: importResult.clubId!,
      settings: {
        currency: { name: "ARS", rate: 100 },
        preferences: { "economy.riskTolerance": "conservative" }
      }
    });

    const squadEconomy = await getSquadEconomy(importResult.clubId!);

    expect(squadEconomy.snapshotDate).toBe("2026-08-05");
    expect(squadEconomy.manual).toEqual({
      currency: { name: "ARS", rate: 100 },
      riskTolerance: "conservative"
    });
    expect(squadEconomy.derived.totalWage).toMatchObject({
      amount: 12000,
      currency: "ARS",
      isComplete: true
    });
    expect(squadEconomy.derived.totalEstimatedValue).toMatchObject({
      amount: 450000,
      currency: "ARS",
      isComplete: true
    });
    expect(squadEconomy.derived.wageToValueRatio).toBe(0.0267);
    expect(squadEconomy.derived.concentration.wage[0]).toMatchObject({
      name: "Tomas Alvarez",
      share: 1
    });
    expect(squadEconomy.derived.playerDetails[0]).toMatchObject({
      name: "Tomas Alvarez",
      wageShare: 1,
      estimatedValueShare: 1,
      wageToValueRatio: 0.0267,
      warnings: []
    });
    expect(squadEconomy.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "salary_concentration",
          severity: "high"
        })
      ])
    );
  });

  it("uses comparable historical snapshots when currencies are available", async () => {
    const first = readValidSnapshot();
    const second = {
      ...first,
      source: { ...first.source, exportedAt: "2026-08-12T12:00:00.000Z" },
      snapshot: { ...first.snapshot, snapshotDate: "2026-08-12", week: 5 },
      players: first.players.map((player) => ({
        ...player,
        wage: { ...player.wage, amount: 15000 },
        estimatedValue: { ...player.estimatedValue, amount: 460000 }
      }))
    };

    const importResult = await importPlayerSnapshot({ payload: first });
    await importPlayerSnapshot({ payload: second });

    const squadEconomy = await getSquadEconomy(importResult.clubId!);

    expect(squadEconomy.historical.comparableSnapshotCount).toBe(2);
    expect(squadEconomy.historical.previousSnapshot?.snapshotDate).toBe("2026-08-05");
    expect(squadEconomy.historical.currentSnapshot?.snapshotDate).toBe("2026-08-12");
    expect(squadEconomy.historical.changes).toMatchObject({
      totalWageDelta: 3000,
      totalWageDeltaPercent: 0.25,
      totalEstimatedValueDelta: 10000,
      totalEstimatedValueDeltaPercent: 0.0222
    });
    expect(squadEconomy.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "wage_growth_without_asset_growth" })
      ])
    );
  });


  it("marks totals incomplete when player economy data is partial", async () => {
    const payload = {
      ...readValidSnapshot(),
      players: [
        ...readValidSnapshot().players,
        {
          ...readValidSnapshot().players[0],
          externalId: "partial-player",
          name: "Partial Player",
          wage: { amount: 0, currency: "ARS" },
          estimatedValue: { amount: 0, currency: "ARS" }
        }
      ]
    };

    const importResult = await importPlayerSnapshot({ payload });

    const squadEconomy = await getSquadEconomy(importResult.clubId!);

    expect(squadEconomy.observed.coverage).toMatchObject({
      playerCount: 2,
      playersWithWage: 1,
      playersWithEstimatedValue: 1
    });
    expect(squadEconomy.derived.totalWage.isComplete).toBe(false);
    expect(squadEconomy.derived.totalEstimatedValue.isComplete).toBe(false);
    expect(squadEconomy.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "partial_player_economy_data" })])
    );
    expect(squadEconomy.derived.playerDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Partial Player",
          warnings: expect.arrayContaining([
            expect.objectContaining({ code: "partial_player_detail" })
          ])
        })
      ])
    );
    expect(squadEconomy.findings.every((finding) => finding.confidence !== "high")).toBe(true);
  });

  it("explains high relative wage to value findings with player evidence", async () => {
    const payload = {
      ...readValidSnapshot(),
      players: [
        {
          ...readValidSnapshot().players[0],
          wage: { amount: 40000, currency: "ARS" },
          estimatedValue: { amount: 450000, currency: "ARS" }
        },
        {
          ...readValidSnapshot().players[0],
          externalId: "low-cost-player",
          name: "Low Cost Player",
          wage: { amount: 1000, currency: "ARS" },
          estimatedValue: { amount: 300000, currency: "ARS" }
        }
      ]
    };

    const importResult = await importPlayerSnapshot({ payload });

    const squadEconomy = await getSquadEconomy(importResult.clubId!);

    expect(squadEconomy.derived.playerDetails[0]).toMatchObject({
      name: "Tomas Alvarez",
      wageToValueRatio: 0.0889
    });
    expect(squadEconomy.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "high_relative_wage_to_value",
          severity: "high",
          confidence: "medium",
          evidence: expect.arrayContaining([
            expect.objectContaining({ label: "Ratio salario/valor jugador", value: 0.0889 })
          ])
        })
      ])
    );
  });
});

function readValidSnapshot() {
  return JSON.parse(fs.readFileSync(validSnapshotPath, "utf8")) as {
    source: { exportedAt: string };
    snapshot: { snapshotDate: string; week: number };
    players: Array<{
      externalId: string | null;
      name: string;
      wage: { amount: number; currency: string | null };
      estimatedValue: { amount: number; currency: string | null };
    }>;
  };
}

