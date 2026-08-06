import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ClubModel, ImportEventModel, PlayerModel, SnapshotModel } from "@atlas/database";
import {
  getYouthPipelinePlanning,
  importPlayerSnapshot,
  updateClubOperatingSettings
} from "../src/index.js";

interface SnapshotFixture {
  source: { exportedAt: string };
  snapshot: { snapshotDate: string; week: number };
  players: SnapshotPlayerFixture[];
}

interface SnapshotPlayerFixture {
  externalId: string | null;
  name: string;
  age: number;
  wage: { amount: number; currency: string | null };
  estimatedValue: { amount: number; currency: string | null };
  skills: FixtureSkillSet;
}

type FixtureSkillSet = Record<
  "stamina" | "pace" | "technique" | "passing" | "keeper" | "defender" | "playmaker" | "striker",
  number | null
>;

let mongo: MongoMemoryServer;

const validSnapshotPath = path.resolve(
  "packages/test-fixtures/fixtures/player-snapshot/valid.json"
);

describe("Youth pipeline planning use case", () => {
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

  it("classifies a young senior with strong skills and observed growth as a standout prospect", async () => {
    const first = withPlayer(readValidSnapshot(), {
      age: 20,
      skills: {
        stamina: 8,
        pace: 9,
        technique: 9,
        passing: 8,
        keeper: 1,
        defender: 5,
        playmaker: 9,
        striker: 4
      }
    });
    const second = withSnapshotDate(first, "2026-08-12", 5, {
      pace: 11,
      technique: 10,
      passing: 9,
      playmaker: 10
    });
    const importResult = await importPlayerSnapshot({ payload: first });
    await importPlayerSnapshot({ payload: second });
    await updateClubOperatingSettings({
      clubId: importResult.clubId!,
      manual: { preferences: { "academy.investment": "ambitious" } }
    });

    const pipeline = await getYouthPipelinePlanning({ clubId: importResult.clubId! });

    expect(pipeline.observed.youthAgeThreshold).toBe(23);
    expect(pipeline.manual.academyInvestment).toBe("ambitious");
    expect(pipeline.derived.categoryCounts.standout_prospect).toBe(1);
    expect(pipeline.derived.players[0]).toMatchObject({
      name: "Tomas Alvarez",
      category: "standout_prospect",
      confidence: "medium"
    });
    expect(pipeline.derived.players[0]?.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "standout_young_growth",
          evidence: expect.arrayContaining([
            expect.objectContaining({ kind: "manual", label: "academy.investment" }),
            expect.objectContaining({ kind: "derived", label: "Promedio skills relevantes" })
          ])
        })
      ])
    );
  });

  it("keeps a single-snapshot young senior as insufficient data instead of a strong conclusion", async () => {
    const importResult = await importPlayerSnapshot({
      payload: withPlayer(readValidSnapshot(), { age: 19 })
    });

    const pipeline = await getYouthPipelinePlanning({ clubId: importResult.clubId! });

    expect(pipeline.derived.categoryCounts.insufficient_data).toBe(1);
    expect(pipeline.derived.players[0]).toMatchObject({
      category: "insufficient_data",
      confidence: "low"
    });
    expect(pipeline.derived.players[0]?.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "short_player_history" })])
    );
  });

  it("classifies a young senior with stable comparable skills as stagnation risk", async () => {
    const first = withPlayer(readValidSnapshot(), { age: 22 });
    const second = withSnapshotDate(first, "2026-08-12", 5, {});
    const third = withSnapshotDate(first, "2026-08-19", 6, {});
    const importResult = await importPlayerSnapshot({ payload: first });
    await importPlayerSnapshot({ payload: second });
    await importPlayerSnapshot({ payload: third });

    const pipeline = await getYouthPipelinePlanning({ clubId: importResult.clubId! });

    expect(pipeline.derived.categoryCounts.stagnation_risk).toBe(1);
    expect(pipeline.derived.players[0]).toMatchObject({
      category: "stagnation_risk",
      severity: "medium"
    });
    expect(pipeline.derived.players[0]?.signals).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "young_stagnation_risk" })])
    );
  });

  it("excludes senior players above the explicit youth threshold", async () => {
    const importResult = await importPlayerSnapshot({
      payload: withPlayer(readValidSnapshot(), { age: 24 })
    });

    const pipeline = await getYouthPipelinePlanning({ clubId: importResult.clubId! });

    expect(pipeline.observed.coverage.youngSeniorPlayerCount).toBe(0);
    expect(pipeline.derived.players).toEqual([]);
    expect(pipeline.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "no_young_senior_players" })])
    );
  });
});

function readValidSnapshot(): SnapshotFixture {
  return JSON.parse(fs.readFileSync(validSnapshotPath, "utf8")) as SnapshotFixture;
}

function withPlayer(
  snapshot: SnapshotFixture,
  patch: Partial<SnapshotPlayerFixture>
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
