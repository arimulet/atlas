import currentFixture from "../../test-fixtures/fixtures/sokker-json-api/current.fixture.json" with { type: "json" };
import juniorsFixture from "../../test-fixtures/fixtures/sokker-json-api/juniors.fixture.json" with { type: "json" };
import summaryFixture from "../../test-fixtures/fixtures/sokker-json-api/training-summary.fixture.json" with { type: "json" };
import trainersFixture from "../../test-fixtures/fixtures/sokker-json-api/trainers.fixture.json" with { type: "json" };
import trainingFixture from "../../test-fixtures/fixtures/sokker-json-api/training.fixture.json" with { type: "json" };
import { describe, expect, it, vi } from "vitest";

import type {
  CurrentClubContextDto,
  SokkerDataProvider,
  TrainingDataDto
} from "@atlas/application";
import {
  loadSokkerSyncPayload,
  mapCurrentApiToCurrentClubContext,
  mapJuniorsApiToJuniors,
  mapTrainersApiToTrainers,
  mapTrainingApiToTrainingData,
  mapTrainingSummaryApiToTrainingSummary
} from "@atlas/application";
import type {
  SokkerApiCurrentDto,
  SokkerJuniorsApiDto,
  SokkerTrainersApiDto,
  SokkerTrainingApiDto,
  SokkerTrainingSummaryApiDto
} from "../importer/providers/api/dtos.js";

function createMockProvider() {
  const current = mapCurrentApiToCurrentClubContext(currentFixture as SokkerApiCurrentDto);
  const training = mapTrainingApiToTrainingData((trainingFixture as SokkerTrainingApiDto).players);
  const trainers = mapTrainersApiToTrainers((trainersFixture as SokkerTrainersApiDto).trainers);
  const juniors = mapJuniorsApiToJuniors((juniorsFixture as SokkerJuniorsApiDto).juniors);
  const trainingSummary = mapTrainingSummaryApiToTrainingSummary(
    summaryFixture as SokkerTrainingSummaryApiDto
  );
  const getCurrent = vi.fn(async (): Promise<CurrentClubContextDto> => current);
  const getTraining = vi.fn(async (): Promise<TrainingDataDto> => training);
  const getLivePlayers = vi.fn<SokkerDataProvider["getLivePlayers"]>(async () =>
    training.players.map((player) => ({ id: player.id, formation: player.formation }))
  );
  const getPlayer = vi.fn<SokkerDataProvider["getPlayer"]>(async (playerId) => {
    const player = training.players.find((candidate) => candidate.id === playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found.`);
    }
    return player;
  });
  const getTrainers = vi.fn(async () => trainers);
  const getJuniors = vi.fn(async () => juniors);
  const getJuniorsXml = vi.fn(async () => []);
  const getTrainingSummary = vi.fn(async () => trainingSummary);
  const getJuniorMatches = vi.fn(async () => []);
  const getMatchXml = vi.fn(async () => "");
  const getMatchLineup = vi.fn(async () => ({ homePlayers: [], awayPlayers: [] }));
  const getTransfers = vi.fn(async () => []);
  const getTransferHistory = vi.fn(async () => []);
  const getPlayerTransferHistory = vi.fn(async () => []);

  return {
    current,
    training,
    trainers,
    juniors,
    trainingSummary,
    provider: {
      getCurrent,
      getTraining,
      getLivePlayers,
      getPlayer,
      getTrainers,
      getJuniors,
      getJuniorsXml,
      getTrainingSummary,
      getJuniorMatches,
      getMatchXml,
      getMatchLineup,
      getTransfers,
      getTransferHistory,
      getPlayerTransferHistory
    } satisfies SokkerDataProvider,
    getCurrent,
    getTraining,
    getLivePlayers,
    getPlayer,
    getTrainers,
    getJuniors,
    getJuniorsXml,
    getTrainingSummary,
    getJuniorMatches,
    getMatchXml,
    getMatchLineup
  };
}

describe("SokkerSyncLoader", () => {
  it("loads current first and returns one complete source-independent payload", async () => {
    const mock = createMockProvider();
    const order: string[] = [];
    mock.getCurrent.mockImplementation(async () => {
      order.push("current");
      return mock.current;
    });
    mock.getTraining.mockImplementation(async () => {
      order.push("training");
      return mock.training;
    });
    mock.getTrainers.mockImplementation(async () => {
      order.push("trainer");
      return mock.trainers;
    });
    mock.getJuniors.mockImplementation(async () => {
      order.push("junior");
      return mock.juniors;
    });
    mock.getTrainingSummary.mockImplementation(async () => {
      order.push("training-summary");
      return mock.trainingSummary;
    });

    const payload = await loadSokkerSyncPayload(mock.provider);

    expect(order[0]).toBe("current");
    expect(payload.current.calendar.gameWeek).toBe(1205);
    expect(payload.players).toHaveLength(3);
    expect(payload.trainingWeeks).toHaveLength(3);
    expect(payload.trainers).toHaveLength(3);
    expect(payload.juniors).toHaveLength(2);
    expect(payload.trainingSummary.weeks).toHaveLength(2);
    expect(payload.trainingWeeks[0]?.gameWeek).toBe(1204);
    expect(payload).not.toHaveProperty("player");
    expect(payload).not.toHaveProperty("report");
    expect(payload).not.toHaveProperty("info");
  });

  it("calls every endpoint exactly once per sync", async () => {
    const mock = createMockProvider();

    await loadSokkerSyncPayload(mock.provider);

    expect(mock.getCurrent).toHaveBeenCalledTimes(1);
    expect(mock.getTraining).toHaveBeenCalledTimes(1);
    expect(mock.getTrainers).toHaveBeenCalledTimes(1);
    expect(mock.getJuniors).toHaveBeenCalledTimes(1);
    expect(mock.getTrainingSummary).toHaveBeenCalledTimes(1);
  });

  it("aborts after current fails and does not request secondary resources", async () => {
    const mock = createMockProvider();
    mock.getCurrent.mockRejectedValue(new Error("invalid session"));

    await expect(loadSokkerSyncPayload(mock.provider)).rejects.toThrow(
      "Failed to fetch Sokker current data: invalid session"
    );
    expect(mock.getTraining).not.toHaveBeenCalled();
    expect(mock.getTrainers).not.toHaveBeenCalled();
    expect(mock.getJuniors).not.toHaveBeenCalled();
    expect(mock.getTrainingSummary).not.toHaveBeenCalled();
  });

  it.each([
    ["training", "getTraining"],
    ["live players", "getLivePlayers"],
    ["trainer", "getTrainers"],
    ["junior", "getJuniors"],
    ["training summary", "getTrainingSummary"]
  ] as const)("aborts when %s fails", async (resource, method) => {
    const mock = createMockProvider();
    mock[method].mockRejectedValue(new Error(`${resource} unavailable`));

    await expect(loadSokkerSyncPayload(mock.provider)).rejects.toThrow(
      `Failed to fetch Sokker ${resource} data: ${resource} unavailable`
    );
  });

  it("propagates mapper failures and does not build a partial payload", async () => {
    const mock = createMockProvider();
    mock.getTrainers.mockRejectedValue(new Error("Failed to map Sokker trainer response."));

    await expect(loadSokkerSyncPayload(mock.provider)).rejects.toThrow(
      "Failed to fetch Sokker trainer data: Failed to map Sokker trainer response."
    );
  });

  it("enriches players with live formations from getLivePlayers", async () => {
    const mock = createMockProvider();
    mock.getLivePlayers.mockResolvedValue([{ id: mock.training.players[0]!.id, formation: "DEF" }]);

    const payload = await loadSokkerSyncPayload(mock.provider);

    expect(payload.players[0]?.formation).toBe("DEF");
  });

  it("does not clobber player formation with null and falls back to skills inference", async () => {
    const mock = createMockProvider();
    mock.getLivePlayers.mockResolvedValue([
      { id: mock.training.players[0]!.id, formation: null },
      ...mock.training.players
        .slice(1)
        .map((player) => ({ id: player.id, formation: player.formation }))
    ]);

    const payload = await loadSokkerSyncPayload(mock.provider);

    expect(payload.players[0]?.formation).not.toBeNull();
  });

  it("uses live players as the current snapshot roster while excluding players who left the club", async () => {
    const mock = createMockProvider();
    const soldPlayer = mock.training.players[2]!;
    const boughtPlayer = {
      ...mock.training.players[0]!,
      id: 50000001,
      teamId: mock.current.team.id,
      name: { firstName: "New", lastName: "Signing", fullName: "New Signing" }
    };
    const boughtReport = { ...mock.training.trainingWeeks[0]!, playerId: boughtPlayer.id };

    soldPlayer.teamId = 30931;
    mock.training.players.push(boughtPlayer);
    mock.training.trainingWeeks.push(boughtReport);
    mock.getLivePlayers.mockResolvedValue(
      mock.training.players
        .filter((player) => player.id !== soldPlayer.id)
        .map((player) => ({ id: player.id, formation: player.formation }))
    );

    const payload = await loadSokkerSyncPayload(mock.provider);

    expect(payload.players.map((player) => player.id)).toEqual(
      expect.arrayContaining([boughtPlayer.id])
    );
    expect(payload.players.map((player) => player.id)).not.toContain(soldPlayer.id);
    expect(payload.trainingWeeks.map((trainingWeek) => trainingWeek.playerId)).not.toContain(
      soldPlayer.id
    );
    expect(payload.excludedTrainingPlayerIds).toEqual([soldPlayer.id]);
  });

  it("excludes a dismissed player even when a stale training report still has the former team id", async () => {
    const mock = createMockProvider();
    const dismissedPlayer = mock.training.players[2]!;

    mock.getLivePlayers.mockResolvedValue(
      mock.training.players
        .filter((player) => player.id !== dismissedPlayer.id)
        .map((player) => ({ id: player.id, formation: player.formation }))
    );

    const payload = await loadSokkerSyncPayload(mock.provider);

    expect(payload.players.map((player) => player.id)).not.toContain(dismissedPlayer.id);
    expect(payload.trainingWeeks.map((trainingWeek) => trainingWeek.playerId)).not.toContain(
      dismissedPlayer.id
    );
  });

  it("hydrates current players without a training report for the snapshot", async () => {
    const mock = createMockProvider();
    const boughtPlayer = {
      ...mock.training.players[0]!,
      id: 50000001,
      name: { firstName: "New", lastName: "Signing", fullName: "New Signing" }
    };

    mock.getLivePlayers.mockResolvedValue([
      ...mock.training.players.map((player) => ({ id: player.id, formation: player.formation })),
      { id: boughtPlayer.id, formation: "DEF" }
    ]);
    mock.getPlayer.mockResolvedValue(boughtPlayer);

    const payload = await loadSokkerSyncPayload(mock.provider);

    expect(payload.players.map((player) => player.id)).toContain(boughtPlayer.id);
    expect(payload.trainingWeeks.map((trainingWeek) => trainingWeek.playerId)).not.toContain(
      boughtPlayer.id
    );
    expect(payload.playersWithoutTrainingReportIds).toEqual([boughtPlayer.id]);
  });
});
