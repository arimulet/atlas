import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSokkerDataProvider: vi.fn(),
  importPlayerSnapshotMvp: vi.fn(),
  importTrainingReports: vi.fn(),
  loadSokkerSyncPayload: vi.fn(),
  mapCurrentContextToSnapshotClub: vi.fn(),
  mapJuniorsToSnapshotJuniors: vi.fn(),
  mapPlayersToSnapshotPlayers: vi.fn(),
  validatePlayerSnapshotImport: vi.fn(),
  validateSokkerSyncPayload: vi.fn()
}));

vi.mock("@atlas/application", () => mocks);

import importsRoutes from "../index.js";

const mockPayload = {
  current: {
    team: { id: 6038 },
    calendar: { gameWeek: 1205, seasonWeek: 8 }
  },
  players: [],
  trainingWeeks: [],
  trainers: [],
  juniors: [],
  trainingSummary: { weeks: [] }
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /sokker-sync validation boundary", () => {
  it("does not call persistence when validation returns fatal errors", async () => {
    mocks.createSokkerDataProvider.mockReturnValue({});
    mocks.loadSokkerSyncPayload.mockResolvedValue(mockPayload);
    mocks.validateSokkerSyncPayload.mockReturnValue({
      status: "invalid",
      payload: null,
      errors: [
        {
          severity: "fatal",
          code: "TEAM_ID_MISMATCH",
          message: "Player belongs to another team.",
          path: "players.0.teamId"
        }
      ],
      warnings: []
    });

    const server = Fastify();
    await server.register(importsRoutes);

    const response = await server.inject({
      method: "POST",
      url: "/sokker-sync",
      payload: { login: "ada", password: "secret" }
    });

    expect(response.statusCode).toBe(422);
    expect(mocks.importPlayerSnapshotMvp).not.toHaveBeenCalled();
    expect(mocks.importTrainingReports).not.toHaveBeenCalled();
    expect(response.json().importResult.errors[0]).toEqual({
      path: "players.0.teamId",
      message: "[TEAM_ID_MISMATCH] Player belongs to another team."
    });

    await server.close();
  });

  it("allows persistence to continue when validation has only warnings", async () => {
    mocks.createSokkerDataProvider.mockReturnValue({});
    mocks.loadSokkerSyncPayload.mockResolvedValue(mockPayload);
    mocks.validateSokkerSyncPayload.mockReturnValue({
      status: "valid",
      payload: mockPayload,
      warnings: [
        {
          severity: "warning",
          code: "MISSING_HEAD_TRAINER",
          message: "No head trainer is currently assigned.",
          path: "trainers"
        }
      ]
    });
    mocks.mapCurrentContextToSnapshotClub.mockReturnValue({});
    mocks.mapJuniorsToSnapshotJuniors.mockReturnValue([]);
    mocks.mapPlayersToSnapshotPlayers.mockReturnValue([]);
    mocks.importPlayerSnapshotMvp.mockResolvedValue({
      importResult: {
        status: "accepted",
        errors: [],
        warnings: [],
        importEventId: "event-1",
        snapshotId: "snapshot-1",
        clubId: 6038,
        playerIds: [],
        importedPlayerCount: 0
      },
      summary: null,
      diagnostic: null
    });
    mocks.importTrainingReports.mockResolvedValue(undefined);

    const server = Fastify();
    await server.register(importsRoutes);

    const response = await server.inject({
      method: "POST",
      url: "/sokker-sync",
      payload: { login: "ada", password: "secret" }
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.importPlayerSnapshotMvp).toHaveBeenCalledTimes(1);
    expect(mocks.importTrainingReports).toHaveBeenCalledWith(6038, []);
    expect(response.json().importResult.status).toBe("accepted-with-warnings");
    expect(response.json().importResult.warnings[0].message).toContain("MISSING_HEAD_TRAINER");

    await server.close();
  });
});
