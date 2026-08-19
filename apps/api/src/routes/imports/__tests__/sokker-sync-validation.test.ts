import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSokkerDataProvider: vi.fn(),
  loadSokkerSyncPayload: vi.fn(),
  persistSokkerSync: vi.fn(),
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
    expect(mocks.persistSokkerSync).not.toHaveBeenCalled();
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
    mocks.persistSokkerSync.mockResolvedValue({
      syncRunId: "run-1",
      teamId: 6038,
      gameWeek: 1205,
      usedTransaction: false,
      clubId: "club-1",
      snapshotId: "snapshot-1",
      upserted: {
        players: 0,
        playerSnapshots: 1,
        trainingWeeks: 0,
        trainers: 0,
        juniors: 0,
        trainingSummaryWeeks: 0
      }
    });

    const server = Fastify();
    await server.register(importsRoutes);

    const response = await server.inject({
      method: "POST",
      url: "/sokker-sync",
      payload: { login: "ada", password: "secret" }
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.persistSokkerSync).toHaveBeenCalledTimes(1);
    expect(response.json().importResult.status).toBe("accepted-with-warnings");
    expect(response.json().importResult.warnings[0].message).toContain("MISSING_HEAD_TRAINER");

    await server.close();
  });
});
