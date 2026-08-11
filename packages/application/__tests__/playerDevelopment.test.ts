import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ClubModel, ImportEventModel, PlayerModel, SnapshotModel } from "@atlas/database";
import { getPlayerDevelopment, getYouthPipelinePlanning } from "../src/playerDevelopment/index.js";
import { importPlayerSnapshot } from "../src/playerImport/index.js";
import { updateClubOperatingSettings } from "../src/clubOperatingSettings/index.js";

interface FixturePlayer {
  externalId: string | null;
  name: string;
  skills: {
    stamina: number | null;
    pace: number | null;
    technique: number | null;
    passing: number | null;
    keeper: number | null;
    defender: number | null;
    playmaker: number | null;
    striker: number | null;
  };
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

interface SnapshotFixture {
  source: {
    exportedAt: string;
  };
  snapshot: {
    snapshotDate: string;
    week: number;
  };
  players: FixturePlayer[];
}

let mongo: MongoMemoryServer;

const validSnapshotPath = path.resolve(
  __dirname,
  "../../test-fixtures/fixtures/player-snapshot/valid.json"
);

describe("Player development use case", () => {
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

  it("compares skills for the same stable player across snapshots", async () => {
    const first = readValidSnapshot();
    const second = {
      ...first,
      source: { ...first.source, exportedAt: "2026-08-12T12:00:00.000Z" },
      snapshot: { ...first.snapshot, snapshotDate: "2026-08-12", week: 5 },
      players: first.players.map((player) => ({
        ...player,
        skills: {
          ...player.skills,
          pace: 11,
          passing: 7,
          technique: player.skills.technique
        }
      }))
    };

    const importResult = await importPlayerSnapshot({ payload: first });
    await importPlayerSnapshot({ payload: second });
    await updateClubOperatingSettings({
      clubId: importResult.clubId!,
      settings: { preferences: { "training.priority": "development" } }
    });

    const development = await getPlayerDevelopment(importResult.clubId!);

    expect(development.manual.trainingPriority).toBe("development");
    expect(development.snapshotCount).toBe(2);
    expect(development.derived.players[0]).toMatchObject({
      name: "Tomas Alvarez",
      recentEvolution: {
        improvedSkills: 1,
        declinedSkills: 1,
        comparableSkills: 8,
        confidence: "medium"
      }
    });
    expect(development.derived.players[0]?.skillChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ skill: "pace", direction: "up", delta: 1 }),
        expect.objectContaining({ skill: "passing", direction: "down", delta: -1 })
      ])
    );
    expect(development.derived.players[0]?.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "training_priority_context",
          evidence: expect.arrayContaining([
            expect.objectContaining({ kind: "manual", label: "training.priority" }),
            expect.objectContaining({ label: "Causalidad atribuida", value: "No" })
          ])
        })
      ])
    );
    expect(development.derived.players[0]?.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "stagnation",
          severity: "low",
          confidence: "medium",
          evidence: expect.arrayContaining([
            expect.objectContaining({ kind: "observed", label: "Snapshot anterior" }),
            expect.objectContaining({ kind: "observed", label: "Ventana temporal" }),
            expect.objectContaining({ kind: "derived", label: "Delta neto de skills", value: 0 })
          ])
        })
      ])
    );
  });

  it("classifies observed improvement with skill before and after evidence", async () => {
    const first = readValidSnapshot();
    const second = withSnapshotDate(first, "2026-08-12", 5, {
      pace: 11,
      technique: 10,
      passing: 9
    });
    const third = withSnapshotDate(second, "2026-08-19", 6, {
      pace: 12,
      technique: 11,
      passing: 10
    });

    const importResult = await importPlayerSnapshot({ payload: first });
    await importPlayerSnapshot({ payload: second });
    await importPlayerSnapshot({ payload: third });

    const development = await getPlayerDevelopment(importResult.clubId!);

    expect(development.derived.players[0]?.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "improvement",
          severity: "low",
          confidence: "high",
          evidence: expect.arrayContaining([
            expect.objectContaining({ kind: "observed", label: "pace", value: "11 -> 12 (+1)" }),
            expect.objectContaining({
              kind: "inferred",
              label: "Causalidad de entrenamiento",
              value: "No atribuida"
            })
          ])
        })
      ])
    );
  });

  it("classifies material observed decline with stronger severity", async () => {
    const first = readValidSnapshot();
    const second = withSnapshotDate(first, "2026-08-12", 5, {
      pace: 11,
      technique: 10,
      passing: 9
    });
    const third = withSnapshotDate(second, "2026-08-19", 6, {
      pace: 9,
      technique: 8,
      passing: 8
    });

    const importResult = await importPlayerSnapshot({ payload: first });
    await importPlayerSnapshot({ payload: second });
    await importPlayerSnapshot({ payload: third });

    const development = await getPlayerDevelopment(importResult.clubId!);

    expect(development.derived.players[0]?.findings[0]).toMatchObject({
      type: "decline",
      severity: "high",
      confidence: "high"
    });
  });

  it("warns instead of comparing when stable identity is missing", async () => {
    const first = withoutExternalIds(readValidSnapshot());
    const second = {
      ...first,
      source: { ...first.source, exportedAt: "2026-08-12T12:00:00.000Z" },
      snapshot: { ...first.snapshot, snapshotDate: "2026-08-12", week: 5 }
    };

    const importResult = await importPlayerSnapshot({ payload: first });
    await importPlayerSnapshot({ payload: second });

    const development = await getPlayerDevelopment(importResult.clubId!);

    expect(development.derived.players[0]?.recentEvolution).toMatchObject({
      direction: "insufficient_data",
      comparableSkills: 0,
      confidence: "low"
    });
    expect(development.derived.players[0]?.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "ambiguous_identity" })])
    );
    expect(development.derived.players[0]?.signals).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "needs_more_history" })])
    );
    expect(development.derived.players[0]?.findings[0]).toMatchObject({
      type: "insufficient_data",
      confidence: "low"
    });
  });

  it("marks missing skills as insufficient data without inventing values", async () => {
    const first = readValidSnapshot();
    const second = {
      ...first,
      source: { ...first.source, exportedAt: "2026-08-12T12:00:00.000Z" },
      snapshot: { ...first.snapshot, snapshotDate: "2026-08-12", week: 5 },
      players: first.players.map((player) => ({
        ...player,
        skills: { ...player.skills, striker: null }
      }))
    };

    const importResult = await importPlayerSnapshot({ payload: first });
    await importPlayerSnapshot({ payload: second });

    const development = await getPlayerDevelopment(importResult.clubId!);

    expect(development.derived.players[0]?.skillChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skill: "striker",
          direction: "insufficient_data",
          currentValue: null,
          delta: null
        })
      ])
    );
    expect(development.derived.players[0]?.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "missing_skills" })])
    );
    expect(development.derived.players[0]?.findings[0]).toMatchObject({
      confidence: "medium"
    });
  });

  it("keeps conclusions weak with a single snapshot", async () => {
    const importResult = await importPlayerSnapshot({ payload: readValidSnapshot() });

    const development = await getPlayerDevelopment(importResult.clubId!);

    expect(development.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "few_snapshots" })])
    );
    expect(development.derived.players[0]?.recentEvolution).toMatchObject({
      direction: "insufficient_data",
      comparableSkills: 0,
      confidence: "low"
    });
    expect(development.derived.players[0]?.findings[0]).toMatchObject({
      type: "insufficient_data",
      severity: "info"
    });
  });
});

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
      settings: { preferences: { "academy.investment": "ambitious" } }
    });

    const pipeline = await getYouthPipelinePlanning(importResult.clubId!);

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
            expect.objectContaining({ kind: "derived", label: "Promedio skills relevantes" }),
            expect.objectContaining({
              kind: "observed",
              label: "Ventana desde",
              value: "2026-08-05"
            }),
            expect.objectContaining({
              kind: "observed",
              label: "Ventana hasta",
              value: "2026-08-12"
            }),
            expect.objectContaining({ kind: "observed", label: "Salario" }),
            expect.objectContaining({ kind: "observed", label: "Valor estimado" })
          ])
        })
      ])
    );
    expect(pipeline.derived.players[0]?.context).toMatchObject({
      window: { from: "2026-08-05", to: "2026-08-12", snapshotCount: 2 },
      dataCompleteness: { completeSkills: true },
      limits: expect.arrayContaining(["Solo jovenes observados en el plantel senior."])
    });
  });

  it("keeps a single-snapshot young senior as insufficient data instead of a strong conclusion", async () => {
    const importResult = await importPlayerSnapshot({
      payload: withPlayer(readValidSnapshot(), { age: 19 })
    });

    const pipeline = await getYouthPipelinePlanning(importResult.clubId!);

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

    const pipeline = await getYouthPipelinePlanning(importResult.clubId!);

    expect(pipeline.derived.categoryCounts.stagnation_risk).toBe(1);
    expect(pipeline.derived.players[0]).toMatchObject({
      category: "stagnation_risk",
      severity: "medium"
    });
    expect(pipeline.derived.players[0]?.signals).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "young_stagnation_risk" })])
    );
  });

  it("keeps contradictory youth signals as follow up instead of a strong prospect or risk", async () => {
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
      pace: 10,
      technique: 8
    });
    const importResult = await importPlayerSnapshot({ payload: first });
    await importPlayerSnapshot({ payload: second });

    const pipeline = await getYouthPipelinePlanning(importResult.clubId!);

    expect(pipeline.derived.categoryCounts.follow_up).toBe(1);
    expect(pipeline.derived.players[0]).toMatchObject({
      category: "follow_up",
      confidence: "low"
    });
    expect(pipeline.derived.players[0]?.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "contradictory_signals",
          evidence: expect.arrayContaining([
            expect.objectContaining({
              kind: "derived",
              label: "Habilidades que subieron",
              value: 1
            }),
            expect.objectContaining({ kind: "derived", label: "Habilidades que bajaron", value: 1 })
          ])
        })
      ])
    );
  });

  it("excludes senior players above the explicit youth threshold", async () => {
    const importResult = await importPlayerSnapshot({
      payload: withPlayer(readValidSnapshot(), { age: 24 })
    });

    const pipeline = await getYouthPipelinePlanning(importResult.clubId!);

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

function withoutExternalIds(snapshot: SnapshotFixture): SnapshotFixture {
  return {
    ...snapshot,
    players: snapshot.players.map((player) => ({ ...player, externalId: null }))
  };
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
