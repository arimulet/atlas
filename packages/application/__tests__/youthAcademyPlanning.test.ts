import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import validYouthSnapshot from "@atlas/test-fixtures/youth-academy-snapshot/valid.json" with {
  type: "json"
};
import { ClubModel, ImportEventModel, YouthSnapshotModel } from "@atlas/database";
import { getRealYouthAcademyPlanning } from "../src/youthAcademyPlanning/index.js";
import { importYouthAcademySnapshot } from "../src/youthAcademyImport/index.js";
import { updateClubOperatingSettings } from "../src/clubOperatingSettings/index.js";

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
      YouthSnapshotModel.deleteMany({})
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it("returns real youth academy planning from the latest youth snapshot and effective settings", async () => {
    const importResult = await importYouthAcademySnapshot({ payload: validYouthSnapshot });

    await updateClubOperatingSettings({
      clubId: importResult.clubId!,
      manual: {
        preferences: {
          "academy.investment": "ambitious"
        }
      }
    });

    const planning = await getRealYouthAcademyPlanning(importResult.clubId!);

    expect(planning.clubId).toBe(importResult.clubId);
    expect(planning.snapshotId).toBe(importResult.snapshotId);
    expect(planning.snapshotDate).toBe("2026-08-08");
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
    const payload = structuredClone(validYouthSnapshot);
    payload.academy.players[0]!.weeksRemaining = 0;
    payload.academy.players[0]!.status = "ready_for_promotion";

    const importResult = await importYouthAcademySnapshot({ payload });
    const planning = await getRealYouthAcademyPlanning(importResult.clubId!);

    expect(planning.derived.categoryCounts.ready_for_promotion).toBe(1);
    expect(planning.derived.players[0]!.category).toBe("ready_for_promotion");
    expect(planning.derived.players[0]!.rationale).toContain("listo para ser promovido");
  });

  it("classifies stagnation risk for youth with 16+ weeks in academy and non-high level", async () => {
    const payload = structuredClone(validYouthSnapshot);
    payload.academy.players[0]!.weeksInAcademy = 18;
    payload.academy.players[0]!.weeksRemaining = 12;
    payload.academy.players[0]!.estimatedLevel = "average";

    const importResult = await importYouthAcademySnapshot({ payload });
    const planning = await getRealYouthAcademyPlanning(importResult.clubId!);

    expect(planning.derived.categoryCounts.stagnation_risk).toBe(1);
    expect(planning.derived.players[0]!.category).toBe("stagnation_risk");
    expect(planning.derived.players[0]!.severity).toBe("medium");
  });

  it("handles empty planning gracefully when a club has no youth snapshots", async () => {
    const club = await ClubModel.create({
      name: "Club Sin Cantera",
      observed: { name: "Club Sin Cantera" },
      manual: {},
      profile: { name: "Club Sin Cantera" }
    });

    const planning = await getRealYouthAcademyPlanning(club.id);

    expect(planning.snapshotId).toBeNull();
    expect(planning.observed.coverage.totalYouthCount).toBe(0);
    expect(planning.derived.players).toEqual([]);
    expect(planning.warnings[0]?.code).toBe("no_youth_snapshots");
  });
});
