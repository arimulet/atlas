import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ClubModel, ImportEventModel, PlayerModel, SnapshotModel } from "@atlas/database";
import { getSquadMarketPlanning } from "../src/marketPlanning/index.js";
import { importPlayerSnapshot } from "../src/playerImport/index.js";
import { updateClubOperatingSettings } from "../src/clubOperatingSettings/index.js";

interface SnapshotFixture {
  source: {
    exportedAt: string;
  };
  snapshot: {
    snapshotDate: string;
    week: number;
  };
  players: Array<{
    externalId: string | null;
    name: string;
    age: number;
    wage: { amount: number; currency: string | null };
    estimatedValue: { amount: number; currency: string | null };
    skills: FixtureSkillSet;
  }>;
}

type FixtureSkillSet = Record<
  "stamina" | "pace" | "technique" | "passing" | "keeper" | "defender" | "playmaker" | "striker",
  number | null
>;

let mongo: MongoMemoryServer;

const validSnapshotPath = path.resolve(
  __dirname,
  "../../test-fixtures/fixtures/player-snapshot/valid.json"
);

describe("Squad market planning use case", () => {
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

  it("classifies an older high-cost player as a prudent sale candidate", async () => {
    const first = withPlayer(readValidSnapshot(), {
      age: 31,
      wage: { amount: 40000, currency: "ARS" },
      estimatedValue: { amount: 450000, currency: "ARS" }
    });
    const second = withSnapshotDate(first, "2026-08-12", 5, {});
    const importResult = await importPlayerSnapshot({ payload: first });
    await importPlayerSnapshot({ payload: second });
    await updateClubOperatingSettings({
      clubId: importResult.clubId!,
      manual: { preferences: { "market.strategy": "conservative" } }
    });

    const planning = await getSquadMarketPlanning(importResult.clubId!);

    expect(planning.manual.marketStrategy).toBe("conservative");
    expect(planning.derived.categoryCounts.sale_candidate).toBe(1);
    expect(planning.derived.players[0]).toMatchObject({
      name: "Tomas Alvarez",
      category: "sale_candidate",
      confidence: "medium"
    });
    expect(planning.derived.players[0]?.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "high_internal_cost",
          evidence: expect.arrayContaining([
            expect.objectContaining({ kind: "manual", label: "market.strategy" }),
            expect.objectContaining({ kind: "derived", label: "Ratio salario/valor" })
          ])
        })
      ])
    );
  });

  it("classifies a young improving player as a protection candidate", async () => {
    const first = withPlayer(readValidSnapshot(), { age: 20 });
    const second = withSnapshotDate(first, "2026-08-12", 5, {
      pace: 11,
      technique: 10,
      passing: 9
    });
    const importResult = await importPlayerSnapshot({ payload: first });
    await importPlayerSnapshot({ payload: second });

    const planning = await getSquadMarketPlanning(importResult.clubId!);

    expect(planning.derived.categoryCounts.protection_candidate).toBe(1);
    expect(planning.derived.players[0]).toMatchObject({
      category: "protection_candidate",
      severity: "medium"
    });
    expect(planning.derived.players[0]?.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "young_asset_protection",
          message: expect.stringContaining("proteger")
        })
      ])
    );
  });

  it("keeps the category insufficient when core value or wage data is missing", async () => {
    const payload = withPlayer(readValidSnapshot(), {
      wage: { amount: 0, currency: "ARS" },
      estimatedValue: { amount: 0, currency: "ARS" }
    });
    const importResult = await importPlayerSnapshot({ payload });

    const planning = await getSquadMarketPlanning(importResult.clubId!);

    expect(planning.derived.players[0]).toMatchObject({
      category: "insufficient_signal",
      confidence: "low"
    });
    expect(planning.derived.players[0]?.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "missing_market_core_data" })])
    );
    expect(planning.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "partial_market_data" })])
    );
  });

  it("explains near-term timing for an older player with declining internal value", async () => {
    const first = withPlayer(readValidSnapshot(), {
      age: 31,
      wage: { amount: 26000, currency: "ARS" },
      estimatedValue: { amount: 600000, currency: "ARS" }
    });
    const second = withSnapshotDate(first, "2026-08-12", 5, {});
    const third = withPlayer(withSnapshotDate(first, "2026-08-19", 6, {}), {
      age: 31,
      wage: { amount: 30000, currency: "ARS" },
      estimatedValue: { amount: 480000, currency: "ARS" }
    });
    const importResult = await importPlayerSnapshot({ payload: first });
    await importPlayerSnapshot({ payload: second });
    await importPlayerSnapshot({ payload: third });

    const planning = await getSquadMarketPlanning(importResult.clubId!);

    expect(planning.derived.players[0]).toMatchObject({
      category: "sale_candidate",
      timing: {
        label: "Revision cercana",
        window: { from: "2026-08-05", to: "2026-08-19", snapshotCount: 3 }
      }
    });
    expect(planning.derived.players[0]?.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "senior_declining_value_timing",
          evidence: expect.arrayContaining([
            expect.objectContaining({ label: "Variacion valor %" })
          ])
        })
      ])
    );
  });

  it("keeps contradictory timing at low confidence", async () => {
    const first = withPlayer(readValidSnapshot(), {
      age: 22,
      estimatedValue: { amount: 700000, currency: "ARS" }
    });
    const second = withPlayer(withSnapshotDate(first, "2026-08-12", 5, { pace: 11 }), {
      age: 22,
      estimatedValue: { amount: 600000, currency: "ARS" }
    });
    const importResult = await importPlayerSnapshot({ payload: first });
    await importPlayerSnapshot({ payload: second });

    const planning = await getSquadMarketPlanning(importResult.clubId!);

    expect(planning.derived.players[0]).toMatchObject({
      confidence: "low",
      timing: { label: "Timing contradictorio" }
    });
    expect(planning.derived.players[0]?.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "contradictory_market_signals" })])
    );
  });
});

function readValidSnapshot(): SnapshotFixture {
  return JSON.parse(fs.readFileSync(validSnapshotPath, "utf8")) as SnapshotFixture;
}

function withPlayer(
  snapshot: SnapshotFixture,
  patch: Partial<SnapshotFixture["players"][number]>
): SnapshotFixture {
  return {
    ...snapshot,
    players: snapshot.players.map((player) => ({ ...player, ...patch }))
  };
}

function withSnapshotDate(
  snapshot: SnapshotFixture,
  snapshotDate: string,
  week: number,
  skills: Partial<FixtureSkillSet>
): SnapshotFixture {
  return {
    ...snapshot,
    source: { ...snapshot.source, exportedAt: `${snapshotDate}T12:00:00.000Z` },
    snapshot: { ...snapshot.snapshot, snapshotDate, week },
    players: snapshot.players.map((player) => ({
      ...player,
      skills: { ...player.skills, ...skills }
    }))
  };
}
