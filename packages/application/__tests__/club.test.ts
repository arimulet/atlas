import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  ClubModel,
  ImportEventModel,
  MongoClubRepository,
  PlayerModel,
  SnapshotModel
} from "@atlas/database";
import {
  compareClubSnapshots,
  getClubDashboard,
  getClubProfile,
  getClubSnapshots,
  updateClubProfile
} from "../src/club/index.js";
import { updateClubOperatingSettings } from "../src/clubOperatingSettings/index.js";
import { importPlayerSnapshot } from "../src/playerImport/index.js";
import { PlayerSnapshotV0 } from "@atlas/contracts";
import validSnapshot from "@atlas/test-fixtures/player-snapshot/valid.json" with { type: "json" };

interface DashboardSnapshotFixture {
  source: { exportedAt: string };
  snapshot: { snapshotDate: string; week: number };
  players: DashboardSnapshotPlayerFixture[];
}

interface DashboardSnapshotPlayerFixture {
  name: string;
  age: number;
  wage: { amount: number; currency: string | null };
  estimatedValue: { amount: number; currency: string | null };
  skills: {
    stamina?: number | null;
    pace?: number | null;
    technique?: number | null;
    passing?: number | null;
    keeper?: number | null;
    defender?: number | null;
    playmaker?: number | null;
    striker?: number | null;
  };
}

let mongo: MongoMemoryServer;

const clubs = new MongoClubRepository();

const validSnapshotPath = path.resolve(
  __dirname,
  "../../test-fixtures/fixtures/player-snapshot/valid.json"
);

describe("Club dashboard use case", () => {
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

  it("shows profile, effective settings and snapshot readiness without hiding provenance", async () => {
    const importResult = await importPlayerSnapshot({ payload: readValidSnapshot() });

    await updateClubOperatingSettings({
      clubId: importResult.clubId!,
      settings: {
        currency: { name: "ARS", rate: 100 },
        week: 6,
        preferences: {
          "market.strategy": "opportunistic"
        }
      }
    });

    const dashboard = await getClubDashboard(importResult.clubId!);

    expect(dashboard.club).toMatchObject({
      name: "River Plate Forever",
      week: 4
    });
    expect(dashboard.club.settings).toMatchObject({
      currency: { name: "ARS", rate: 100 },
      week: 6
    });
    expect(dashboard.settings.effective).toMatchObject({
      currency: { name: "ARS", rate: 100 },
      week: 6,
      preferences: {
        "economy.riskTolerance": "balanced",
        "training.priority": "balanced",
        "academy.investment": "balanced",
        "market.strategy": "opportunistic"
      }
    });
    expect(dashboard.snapshots).toMatchObject({
      available: true,
      count: 1,
      canCompare: false
    });
    expect(dashboard.snapshots.latest).toMatchObject({
      snapshotDate: "2026-08-05",
      season: 78,
      week: 4,
      playerCount: 1
    });
    expect(dashboard.operationalAreas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "diagnostic", status: "available" }),
        expect.objectContaining({ key: "history", status: "ready" }),
        expect.objectContaining({ key: "squad-economy", status: "available" })
      ])
    );
  });

  it("marks historical access available when the club has at least two snapshots", async () => {
    const first = readValidSnapshot();
    const second = {
      ...first,
      source: { ...first.source, exportedAt: "2026-08-12T12:00:00.000Z" },
      snapshot: { ...first.snapshot, snapshotDate: "2026-08-12", week: 5 }
    };

    const importResult = await importPlayerSnapshot({ payload: first });
    await importPlayerSnapshot({ payload: second });

    const dashboard = await getClubDashboard(importResult.clubId!);

    expect(dashboard.snapshots.count).toBe(2);
    expect(dashboard.snapshots.canCompare).toBe(true);
    expect(dashboard.snapshots.previous?.snapshotDate).toBe("2026-08-05");
    expect(dashboard.snapshots.latest?.snapshotDate).toBe("2026-08-12");
    expect(dashboard.operationalAreas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "history", status: "available" }),
        expect.objectContaining({ key: "findings", status: "available" })
      ])
    );
  });

  it("integrates player development signals without treating insufficient data as a strong conclusion", async () => {
    const importResult = await importPlayerSnapshot({ payload: readValidSnapshot() });

    const dashboard = await getClubDashboard(importResult.clubId!);

    expect(dashboard.developmentSummary).toMatchObject({
      available: true,
      observed: {
        snapshotCount: 1,
        latestSnapshotDate: "2026-08-05",
        playerCount: 1
      },
      settings: {
        trainingPriority: "balanced"
      },
      derived: {
        improvingPlayers: 0,
        stagnatedPlayers: 0,
        decliningPlayers: 0,
        insufficientDataPlayers: 1
      },
      inferred: {
        warning: "Hay pocos snapshots; ATLAS solo muestra datos actuales sin evaluar evolucion."
      }
    });
    expect(dashboard.developmentSummary.inferred.highlightedPlayers[0]).toMatchObject({
      name: "Tomas Alvarez",
      signal: "insufficient_data",
      severity: "info",
      confidence: "low"
    });
  });

  it("summarizes improvement and decline counts for the operational dashboard", async () => {
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
          technique: 10,
          passing: 9
        }
      }))
    };

    const importResult = await importPlayerSnapshot({ payload: first });
    await importPlayerSnapshot({ payload: second });

    const dashboard = await getClubDashboard(importResult.clubId!);

    expect(dashboard.developmentSummary.derived).toMatchObject({
      improvingPlayers: 1,
      stagnatedPlayers: 0,
      decliningPlayers: 0,
      insufficientDataPlayers: 0
    });
    expect(dashboard.developmentSummary.inferred.headline).toBe(
      "Hay mejoras observadas en habilidades visibles."
    );
    expect(dashboard.developmentSummary.inferred.highlightedPlayers[0]).toMatchObject({
      name: "Tomas Alvarez",
      signal: "improvement"
    });
  });

  it("integrates internal market signals without treating insufficient data as a sale signal", async () => {
    const importResult = await importPlayerSnapshot({ payload: readValidSnapshot() });

    const dashboard = await getClubDashboard(importResult.clubId!);

    expect(dashboard.marketSummary).toMatchObject({
      available: true,
      observed: {
        snapshotCount: 1,
        latestSnapshotDate: "2026-08-05",
        playerCount: 1
      },
      settings: {
        marketStrategy: "balanced"
      },
      derived: {
        saleCandidates: 0,
        protectionCandidates: 0,
        followUpPlayers: 0,
        insufficientSignalPlayers: 1
      }
    });
    expect(dashboard.marketSummary.inferred.headline).toBe(
      "Lectura prudente: hay jugadores con datos insuficientes para mercado interno."
    );
    expect(dashboard.marketSummary.inferred.highlightedPlayers).toEqual([]);
  });

  it("summarizes internal sale candidates for the operational dashboard", async () => {
    const first = withPlayer(readValidSnapshot(), {
      age: 31,
      wage: { amount: 40000, currency: "ARS" },
      estimatedValue: { amount: 450000, currency: "ARS" }
    });
    const second = {
      ...first,
      source: { ...first.source, exportedAt: "2026-08-12T12:00:00.000Z" },
      snapshot: { ...first.snapshot, snapshotDate: "2026-08-12", week: 5 }
    };
    const importResult = await importPlayerSnapshot({ payload: first });
    await importPlayerSnapshot({ payload: second });
    await updateClubOperatingSettings({
      clubId: importResult.clubId!,
      settings: { preferences: { "market.strategy": "conservative" } }
    });

    const dashboard = await getClubDashboard(importResult.clubId!);

    expect(dashboard.marketSummary.derived).toMatchObject({
      saleCandidates: 1,
      protectionCandidates: 0,
      followUpPlayers: 0,
      insufficientSignalPlayers: 0
    });
    expect(dashboard.marketSummary.inferred.headline).toBe(
      "Hay candidatos internos para revisar timing de venta sin automatizar decisiones."
    );
    expect(dashboard.marketSummary.inferred.highlightedPlayers[0]).toMatchObject({
      name: "Tomas Alvarez",
      signal: "sale_candidate",
      confidence: "medium"
    });
  });

  it("integrates senior youth pipeline without presenting it as real academy data", async () => {
    const importResult = await importPlayerSnapshot({
      payload: withPlayer(readValidSnapshot(), { age: 19 })
    });
    await updateClubOperatingSettings({
      clubId: importResult.clubId!,
      settings: { preferences: { "academy.investment": "ambitious" } }
    });

    const dashboard = await getClubDashboard(importResult.clubId!);

    expect(dashboard.youthPipelineSummary).toMatchObject({
      available: true,
      observed: {
        snapshotCount: 1,
        latestSnapshotDate: "2026-08-05",
        youngSeniorPlayerCount: 1,
        youthAgeThreshold: 23
      },
      settings: {
        academyInvestment: "ambitious"
      },
      derived: {
        standoutProspects: 0,
        followUpPlayers: 0,
        stagnationRiskPlayers: 0,
        insufficientDataPlayers: 1
      }
    });
    expect(dashboard.youthPipelineSummary.inferred.headline).toBe(
      "Lectura prudente: hay jovenes senior con datos insuficientes."
    );
    expect(dashboard.youthPipelineSummary.inferred.warning).toContain("plantel senior");
    expect(dashboard.operationalAreas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "youth-pipeline-planning",
          label: "Pipeline juvenil senior",
          status: "available"
        })
      ])
    );
  });

  it("summarizes highlighted youth players and counts when comparable snapshots exist", async () => {
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
    const second = {
      ...first,
      source: { ...first.source, exportedAt: "2026-08-12T12:00:00.000Z" },
      snapshot: { ...first.snapshot, snapshotDate: "2026-08-12", week: 5 },
      players: first.players.map((p) => ({
        ...p,
        skills: { ...p.skills, pace: 11, technique: 10, passing: 9, playmaker: 10 }
      }))
    };
    const importResult = await importPlayerSnapshot({ payload: first });
    await importPlayerSnapshot({ payload: second });
    await updateClubOperatingSettings({
      clubId: importResult.clubId!,
      settings: { preferences: { "academy.investment": "ambitious" } }
    });

    const dashboard = await getClubDashboard(importResult.clubId!);

    expect(dashboard.youthPipelineSummary.derived).toMatchObject({
      standoutProspects: 1,
      followUpPlayers: 0,
      stagnationRiskPlayers: 0,
      insufficientDataPlayers: 0
    });
    expect(dashboard.youthPipelineSummary.inferred.headline).toBe(
      "Hay prospectos destacados dentro del plantel senior."
    );
    expect(dashboard.youthPipelineSummary.inferred.highlightedPlayers[0]).toMatchObject({
      name: "Tomas Alvarez",
      signal: "standout_prospect",
      confidence: "medium"
    });
    expect(dashboard.youthPipelineSummary.detailPath).toBe(
      `/clubs/${importResult.clubId!}/youth-pipeline-planning`
    );
  });

  it("handles a club without young senior players as a prudent empty state", async () => {
    const importResult = await importPlayerSnapshot({
      payload: withPlayer(readValidSnapshot(), { age: 28 })
    });

    const dashboard = await getClubDashboard(importResult.clubId!);

    expect(dashboard.youthPipelineSummary).toMatchObject({
      available: true,
      observed: {
        snapshotCount: 1,
        youngSeniorPlayerCount: 0,
        youthAgeThreshold: 23
      },
      derived: {
        standoutProspects: 0,
        followUpPlayers: 0,
        stagnationRiskPlayers: 0,
        insufficientDataPlayers: 0
      },
      inferred: {
        headline: "No se observan jugadores jovenes (<= 23) en el plantel senior.",
        highlightedPlayers: []
      }
    });
    expect(dashboard.youthPipelineSummary.inferred.warning).toContain("plantel senior");
  });

  it("handles a club without snapshots with unavailable youth pipeline and ready status", async () => {
    const club = await clubs.save({
      clubId: 999,
      country: 1,
      name: "Club Sin Snapshots",
      week: null,
      currency: { name: "ARS", rate: 100 }
    });

    const dashboard = await getClubDashboard(club.id);

    expect(dashboard.youthPipelineSummary).toMatchObject({
      available: false,
      observed: {
        snapshotCount: 0,
        latestSnapshotDate: null,
        seniorPlayerCount: 0,
        youngSeniorPlayerCount: 0,
        youthAgeThreshold: 23
      },
      derived: {
        standoutProspects: 0,
        followUpPlayers: 0,
        stagnationRiskPlayers: 0,
        insufficientDataPlayers: 0
      },
      inferred: {
        headline: "Sin snapshots importados para analizar jovenes del plantel senior.",
        highlightedPlayers: []
      }
    });
    expect(dashboard.operationalAreas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "youth-pipeline-planning",
          label: "Pipeline juvenil senior",
          status: "ready"
        })
      ])
    );
  });
});

describe("Club profile use cases", () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  beforeEach(async () => {
    await ClubModel.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it("reads a minimal operational profile", async () => {
    const club = await clubs.save({
      clubId: 1,
      country: 1,
      name: "River Plate Forever",
      week: 4,
      currency: { name: "ARS", rate: 100 }
    });

    const profile = await getClubProfile(club.id);

    expect(profile).toMatchObject({
      name: "River Plate Forever",
      settings: {
        currency: { name: "ARS", rate: 100 }
      },
      week: 4
    });
  });

  it("updates settings assumptions and preferences separately from observed values", async () => {
    const club = await clubs.save({
      clubId: 1,
      country: 1,
      name: "River Plate Forever",
      week: 4,
      currency: { name: "ARS", rate: 100 }
    });

    const profile = await updateClubProfile({
      clubId: club.id,
      settings: {
        currency: { name: "ARS", rate: 100 },
        week: 6,
        assumptions: [{ key: "wage-growth", value: "Use conservative wage growth." }],
        preferences: [{ key: "market-style", value: "Avoid short-term flips." }]
      }
    });

    expect(profile.week).toBe(4);
    expect(profile.settings.week).toBe(6);
    expect(profile.settings.currency).toEqual({ name: "ARS", rate: 100 });
    expect(profile.settings.assumptions[0]?.key).toBe("wage-growth");
    expect(profile.settings.preferences[0]?.key).toBe("market-style");
  });
});

describe("CompareClubSnapshots", () => {
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

  it("compares two snapshots resolved by club and date", async () => {
    const base = await importPlayerSnapshot({ payload: payload({ snapshotDate: "2026-08-05" }) });
    const target = await importPlayerSnapshot({
      payload: payload({
        snapshotDate: "2026-08-12",
        player: { wage: 15000, estimatedValue: 500000, pace: 11 }
      })
    });

    const comparison = await compareClubSnapshots({
      clubId: base.clubId!,
      baseSnapshotDate: "2026-08-05",
      targetSnapshotDate: "2026-08-12"
    });
    const snapshots = await getClubSnapshots(base.clubId!);

    expect(target.clubId).toBe(base.clubId);
    expect(snapshots.map((snapshot) => snapshot.snapshotDate)).toEqual([
      "2026-08-05",
      "2026-08-12"
    ]);
    expect(comparison.baseSnapshotId).toBe(base.snapshotId);
    expect(comparison.targetSnapshotId).toBe(target.snapshotId);
    expect(comparison.matchedPlayers[0]?.changes.wage?.delta).toBe(3000);
    expect(comparison.matchedPlayers[0]?.changes.estimatedValue?.delta).toBe(50000);
    expect(comparison.matchedPlayers[0]?.changes.skills).toContainEqual({
      skill: "pace",
      before: 10,
      after: 11,
      delta: 1
    });
  });

  it("requires snapshot id when a club has more than one snapshot for the same date", async () => {
    const first = await importPlayerSnapshot({ payload: payload({ snapshotDate: "2026-08-05" }) });
    await importPlayerSnapshot({ payload: payload({ snapshotDate: "2026-08-05" }) });
    const target = await importPlayerSnapshot({ payload: payload({ snapshotDate: "2026-08-12" }) });

    await expect(
      compareClubSnapshots({
        clubId: first.clubId!,
        baseSnapshotDate: "2026-08-05",
        targetSnapshotId: target.snapshotId!
      })
    ).rejects.toThrow("base snapshot date 2026-08-05 is ambiguous; use snapshot id.");
  });
});

function payload(overrides: {
  snapshotDate: string;
  player?: {
    wage?: number;
    estimatedValue?: number;
    pace?: number;
  };
}): PlayerSnapshotV0 {
  const cloned = structuredClone(validSnapshot) as PlayerSnapshotV0;
  cloned.snapshot.snapshotDate = overrides.snapshotDate;
  cloned.source.exportedAt = `${overrides.snapshotDate}T20:00:00.000Z`;

  const player = cloned.players[0]!;
  player.wage.amount = overrides.player?.wage ?? player.wage.amount;
  player.estimatedValue.amount = overrides.player?.estimatedValue ?? player.estimatedValue.amount;
  player.skills.pace = overrides.player?.pace ?? player.skills.pace;

  return cloned;
}

function readValidSnapshot(): DashboardSnapshotFixture {
  return JSON.parse(fs.readFileSync(validSnapshotPath, "utf8")) as DashboardSnapshotFixture;
}

function withPlayer(
  snapshot: DashboardSnapshotFixture,
  patch: Partial<Omit<DashboardSnapshotPlayerFixture, "skills">> & {
    skills?: Partial<DashboardSnapshotPlayerFixture["skills"]>;
  }
): DashboardSnapshotFixture {
  return {
    ...snapshot,
    players: snapshot.players.map((player) => ({
      ...player,
      ...patch,
      skills: { ...player.skills, ...(patch.skills ?? {}) }
    }))
  };
}
