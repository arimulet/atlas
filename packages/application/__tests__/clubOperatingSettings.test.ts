import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ClubModel, MongoClubRepository } from "@atlas/database";
import {
  getClubOperatingSettings,
  updateClubOperatingSettings
} from "../src/clubOperatingSettings/index.js";

let mongo: MongoMemoryServer;

const clubs = new MongoClubRepository();

describe("Club operating settings use cases", () => {
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

  it("reads effective defaults without mixing them into observed Sokker data", async () => {
    const club = await clubs.save({
      clubId: 1,
      country: 1,
      name: "River Plate Forever",
      week: 4,
      currency: { name: "ARS", rate: 100 }
    });

    const settings = await getClubOperatingSettings(club.id);

    expect(settings.observed).toEqual({ week: 4 });
    expect(settings.settings).toEqual({
      currency: { name: "ARS", rate: 100 },
      week: null,
      preferences: {
        "economy.riskTolerance": "balanced",
        "training.priority": "balanced",
        "academy.investment": "balanced",
        "market.strategy": "balanced"
      }
    });
    expect(settings.effective).toEqual({
      currency: { name: "ARS", rate: 100 },
      week: 4,
      preferences: {
        "economy.riskTolerance": "balanced",
        "training.priority": "balanced",
        "academy.investment": "balanced",
        "market.strategy": "balanced"
      }
    });
  });

  it("updates manual operating settings and keeps observed settings unchanged", async () => {
    const club = await clubs.save({
      clubId: 1,
      country: 1,
      name: "River Plate Forever",
      week: 4,
      currency: { name: "ARS", rate: 100 }
    });

    const settings = await updateClubOperatingSettings({
      clubId: club.id,
      settings: {
        week: 6,
        preferences: {
          "economy.riskTolerance": "conservative",
          "training.priority": "development",
          "academy.investment": "ambitious",
          "market.strategy": "opportunistic"
        }
      }
    });

    expect(settings.observed).toEqual({ week: 4 });
    expect(settings.settings).toMatchObject({
      week: 6,
      preferences: {
        "economy.riskTolerance": "conservative",
        "training.priority": "development",
        "academy.investment": "ambitious",
        "market.strategy": "opportunistic"
      }
    });
    expect(settings.effective).toMatchObject({
      week: 6
    });

    const persisted = await ClubModel.findById(club.id).lean();
    expect(persisted?.week).toBe(4);
    expect(persisted?.settings?.currency).toEqual({ name: "ARS", rate: 100 });
    expect(persisted?.settings?.preferences.map((preference) => preference.key).sort()).toEqual([
      "academy.investment",
      "economy.riskTolerance",
      "market.strategy",
      "training.priority"
    ]);
  });

  it("validates week and preference values clearly", async () => {
    const club = await clubs.save({
      clubId: 1,
      country: 1,
      name: "River Plate Forever",
      currency: { name: "ARS", rate: 100 }
    });

    await expect(
      updateClubOperatingSettings({ clubId: club.id, settings: { week: 17 } })
    ).rejects.toThrow("Operating week must be an integer between 1 and 16.");
    await expect(
      updateClubOperatingSettings({
        clubId: club.id,
        settings: { preferences: { "market.strategy": "reckless" as "balanced" } }
      })
    ).rejects.toThrow("Invalid value for operating preference market.strategy.");
  });

  it("persists manual preference overrides and merges them with initial configuration defaults", async () => {
    const club = await clubs.save({
      clubId: 1,
      country: 1,
      name: "River Plate Forever",
      week: 4,
      currency: { name: "ARS", rate: 100 }
    });

    await updateClubOperatingSettings({
      clubId: club.id,
      settings: {
        preferences: {
          "economy.riskTolerance": "aggressive"
        }
      }
    });

    const settings = await getClubOperatingSettings(club.id);

    expect(settings.settings.preferences).toEqual({
      "economy.riskTolerance": "aggressive",
      "training.priority": "balanced",
      "academy.investment": "balanced",
      "market.strategy": "balanced"
    });
    expect(settings.effective.preferences).toEqual({
      "economy.riskTolerance": "aggressive",
      "training.priority": "balanced",
      "academy.investment": "balanced",
      "market.strategy": "balanced"
    });
  });

  it("preserves existing manual scalar settings during partial preference updates", async () => {
    const club = await clubs.save({
      clubId: 1,
      country: 1,
      name: "River Plate Forever",
      week: 4,
      currency: { name: "ARS", rate: 100 }
    });

    await updateClubOperatingSettings({
      clubId: club.id,
      settings: {
        currency: { name: "ARS", rate: 100 },
        week: 6
      }
    });
    const settings = await updateClubOperatingSettings({
      clubId: club.id,
      settings: {
        preferences: {
          "market.strategy": "opportunistic"
        }
      }
    });

    expect(settings.settings).toMatchObject({
      currency: { name: "ARS", rate: 100 },
      week: 6,
      preferences: {
        "market.strategy": "opportunistic"
      }
    });
  });
});
