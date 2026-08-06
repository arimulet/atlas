import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ClubModel, ImportEventModel, PlayerModel, SnapshotModel } from "@atlas/database";
import {
  getPlayerDevelopment,
  importPlayerSnapshot,
  updateClubOperatingSettings
} from "../src/index.js";

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
  "packages/test-fixtures/fixtures/player-snapshot/valid.json"
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
      manual: { preferences: { "training.priority": "development" } }
    });

    const development = await getPlayerDevelopment({ clubId: importResult.clubId! });

    expect(development.manual.trainingPriority).toBe("development");
    expect(development.snapshotCount).toBe(2);
    expect(development.derived.players[0]).toMatchObject({
      name: "Tomas Alvarez",
      recentEvolution: {
        improvedSkills: 1,
        declinedSkills: 1,
        comparableSkills: 8,
        confidence: "high"
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

    const development = await getPlayerDevelopment({ clubId: importResult.clubId! });

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

    const development = await getPlayerDevelopment({ clubId: importResult.clubId! });

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
  });

  it("keeps conclusions weak with a single snapshot", async () => {
    const importResult = await importPlayerSnapshot({ payload: readValidSnapshot() });

    const development = await getPlayerDevelopment({ clubId: importResult.clubId! });

    expect(development.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "few_snapshots" })])
    );
    expect(development.derived.players[0]?.recentEvolution).toMatchObject({
      direction: "insufficient_data",
      comparableSkills: 0,
      confidence: "low"
    });
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
