import { afterEach, describe, expect, it, vi } from "vitest";
import { MongoCountryRepository, MongoPlayerRepository } from "@atlas/database";
import type { PersistedClub, PersistedPlayerDevelopmentOverride, PersistedSnapshot } from "@atlas/database";
import { getSquadAssessment } from "../squadPlanning/index.js";

vi.mock("@atlas/database", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@atlas/database")>()),
  findFinalMarketTransfersUpToDate: vi.fn().mockResolvedValue([])
}));

const mockClub: PersistedClub = {
  id: "club", clubId: 1, ownerUserId: null, sokkerUsername: null, country: 1,
  currency: "EUR", training: { GK: 2, DEF: 6, MID: 4, ATT: 7 }, name: "Club",
  budget: null, staff: [], gameWeek: 1204, week: 7, lastSnapshotDate: null,
  observedAt: null, settings: { assumptions: [], preferences: [] }
};
const mockSnapshot: PersistedSnapshot = {
  id: "snapshot", clubId: 1, schemaVersion: "1", snapshotDate: new Date("2026-08-12"),
  importedAt: new Date("2026-08-12"), gameWeek: 1204, week: 7, juniors: [],
  players: [{
    id: "player", playerId: 100, name: "Player", age: 24, wage: 0, value: 0,
    form: null, availabilityStatus: "available", observedPosition: "defender",
    training: { position: 2, advanced: false },
    skills: { stamina: 8, keeper: 1, pace: 12, defender: 13, passing: 8,
      technique: 8, playmaker: 5, striker: 3 }
  }]
};

afterEach(() => vi.restoreAllMocks());

describe("saved development objectives in squad assessment", () => {
  it.each([
    [null, null],
    ["sportive", "sportive"],
    ["financial", "financial"],
    [undefined, "sportive"]
  ] as const)("maps saved objective %s to %s", async (objective, expected) => {
    const overrides: PersistedPlayerDevelopmentOverride[] = objective === null ? [] : [{
      id: "override", playerId: 100, clubId: 1, profile: null, objective, targetLevels: {}
    }];
    vi.spyOn(MongoPlayerRepository.prototype, "listDevelopmentOverrides").mockResolvedValue(overrides);
    vi.spyOn(MongoPlayerRepository.prototype, "listSquadRoles").mockResolvedValue([]);
    vi.spyOn(MongoCountryRepository.prototype, "getAll").mockResolvedValue([]);

    const result = await getSquadAssessment("club", {
      club: mockClub, snapshots: [mockSnapshot], trainingWeeks: []
    });

    expect(result.depthPlayers[0]?.configuredDevelopmentObjective).toBe(expected);
  });
});
