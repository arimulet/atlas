import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import validSnapshot from "@atlas/test-fixtures/player-snapshot/valid.json" with {
  type: "json"
};
import { ClubModel, ImportEventModel, SnapshotModel } from "@atlas/database";
import { getRealYouthAcademyPlanning } from "../src/youthAcademyPlanning/index.js";
import { importPlayerSnapshot } from "../src/playerImport/index.js";
import { updateClubOperatingSettings } from "../src/clubOperatingSettings/index.js";
import type { PlayerSnapshotV0 } from "@atlas/contracts";

let mongo: MongoMemoryServer;

describe("Real Youth Academy Planning use case", () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  beforeEach(async () => {
    await Promise.all([
      ClubModel.deleteMany({}),
      ImportEventModel.deleteMany({}),
      SnapshotModel.deleteMany({})
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it("returns real youth academy planning from the latest youth snapshot and effective settings", async () => {
    const importResult = await importPlayerSnapshot({ payload: snapshotWithJuniors() });

    await updateClubOperatingSettings({
      clubId: importResult.clubId!,
      settings: {
        preferences: {
          "academy.investment": "ambitious"
        }
      }
    });

    const planning = await getRealYouthAcademyPlanning(importResult.clubId!);

    expect(planning.clubId).toBe(importResult.clubId!);
    expect(planning.snapshotId).toBe(importResult.snapshotId);
    expect(planning.snapshotDate).toBe("2026-08-05");
    expect(planning.manual.academyInvestment).toBe("ambitious");
    expect(planning.observed.coverage.totalYouthCount).toBe(1);
    expect(planning.derived.players).toHaveLength(1);

    const playerPlan = planning.derived.players[0]!;
    expect(playerPlan.name).toBe("Matias Cantero");
    expect(playerPlan.age).toBe(16);
    expect(playerPlan.weeksRemaining).toBe(4);
    expect(playerPlan.projectedPromotionAge).toBe(16);
    expect(playerPlan.category).toBe("standout_prospect");
    expect(playerPlan.severity).toBe("low");
    expect(playerPlan.confidence).toBe("high");
  });

  it("classifies a youth ready for promotion when weeksRemaining is 0 or status is ready_for_promotion", async () => {
    const payload = snapshotWithJuniors({
      juniors: [{ weeksRemaining: 0, status: "ready_for_promotion" }]
    });

    const importResult = await importPlayerSnapshot({ payload });
    const planning = await getRealYouthAcademyPlanning(importResult.clubId!);

    expect(planning.derived.categoryCounts.ready_for_promotion).toBe(1);
    expect(planning.derived.players[0]!.category).toBe("ready_for_promotion");
    expect(planning.derived.players[0]!.rationale).toContain("listo para ser promovido");
  });

  it("classifies stagnation risk for youth with 16+ weeks in academy and non-high level", async () => {
    // Primera importacion: ancla las semanas iniciales
    const firstPayload = snapshotWithJuniors({
      juniors: [{ weeksRemaining: 20, skill: 5 }]
    });
    await importPlayerSnapshot({ payload: firstPayload });

    // Segunda importacion: avanza el tiempo
    const secondPayload = snapshotWithJuniors({
      juniors: [{ weeksRemaining: 4, skill: 5 }]
    });
    secondPayload.snapshot.snapshotDate = "2026-11-28";

    const importResult = await importPlayerSnapshot({ payload: secondPayload });
    const planning = await getRealYouthAcademyPlanning(importResult.clubId!);

    expect(planning.derived.categoryCounts.stagnation_risk).toBe(1);
    expect(planning.derived.players[0]!.category).toBe("stagnation_risk");
    expect(planning.derived.players[0]!.severity).toBe("medium");
  });

  it("handles empty planning gracefully when a club has no youth snapshots", async () => {
    const club = await ClubModel.create({
      clubId: 999,
      country: 1,
      name: "Club Sin Cantera",
      observed: { name: "Club Sin Cantera" },
      settings: { currency: { name: "ARS", rate: 100 } },
      profile: { name: "Club Sin Cantera" }
    });

    const planning = await getRealYouthAcademyPlanning(club.id);

    expect(planning.snapshotId).toBeNull();
    expect(planning.observed.coverage.totalYouthCount).toBe(0);
    expect(planning.derived.players).toEqual([]);
    expect(planning.warnings[0]?.code).toBe("no_youth_snapshots");
  });
});

function snapshotWithJuniors(options?: {
  juniors?: Array<Partial<NonNullable<PlayerSnapshotV0["juniors"]>[number]>>;
}): PlayerSnapshotV0 {
  const snapshot = structuredClone(validSnapshot) as PlayerSnapshotV0;
  const baseJunior: NonNullable<PlayerSnapshotV0["juniors"]>[number] = {
    playerId: 5001,
    name: "Matias Cantero",
    age: 16,
    initialWeeksRemaining: null,
    weeksRemaining: 4,
    skill: 8,
    status: "in_academy"
  };

  snapshot.juniors = (options?.juniors ?? [{}]).map((junior) => ({
    ...baseJunior,
    ...junior
  }));

  return snapshot;
}
