import { afterEach, describe, expect, it, vi } from "vitest";
import currentFixture from "../../test-fixtures/fixtures/sokker-json-api/current.fixture.json";
import fixture from "../../test-fixtures/fixtures/sokker-json-api/training-week-1217.fixture.json";
import { loadValidatedSokkerSyncPayload } from "../importer/sokker-sync-retry.js";
import { loadSokkerSyncPayload } from "../importer/sokker-sync-loader.js";
import { validateSokkerSyncPayload } from "../importer/sokker-sync-validator.js";
import {
  mapCurrentApiToCurrentClubContext,
  mapTrainingApiToTrainingData,
  mapTrainingSummaryApiToTrainingSummary
} from "../importer/providers/api/mappers.js";
import type { SokkerDataProvider } from "../importer/providers/SokkerDataProvider.js";
import type { SokkerApiCurrentDto } from "../importer/providers/api/dtos.js";
import { SokkerJsonApiProvider } from "../importer/providers/api/SokkerJsonApiProvider.js";
import { DEFAULT_SOKKER_STADIUM } from "@/domain/stadium/mockData.js";

function createMockProvider() {
  const current = mapCurrentApiToCurrentClubContext(currentFixture as SokkerApiCurrentDto);
  current.team.id = 1;
  current.calendar = { season: 79, gameWeek: 1218, seasonWeek: 9, date: "2026-11-14" };
  const training = mapTrainingApiToTrainingData(
    fixture.explicit.players,
    new Map(fixture.knownReportSkills.map((r) => [r.playerId, r.skills])),
    1217
  );
  const incomplete = mapTrainingApiToTrainingData(fixture.latest.players);
  const mockGetTraining = vi.fn<SokkerDataProvider["getTraining"]>().mockResolvedValue(training);
  const mockGetCurrent = vi.fn(async () => current);
  const mockGetTrainingSummary = vi.fn(async () =>
    mapTrainingSummaryApiToTrainingSummary({ weeks: [fixture.summary] })
  );
  const provider: SokkerDataProvider = {
    getCurrent: mockGetCurrent,
    getArena: vi.fn(async () => DEFAULT_SOKKER_STADIUM),
    getTraining: mockGetTraining,
    getTrainingSummary: mockGetTrainingSummary,
    getLivePlayers: vi.fn(async () =>
      incomplete.players.map((p) => ({ id: p.id, formation: p.formation }))
    ),
    getPlayer: vi.fn(async (id) => ({ ...incomplete.players[0]!, id })),
    getTrainers: vi.fn(async () => []),
    getJuniors: vi.fn(async () => []),
    getJuniorsXml: vi.fn(async () => []),
    getJuniorMatches: vi.fn(async () => []),
    getMatchXml: vi.fn(async () => ""),
    getMatchLineup: vi.fn(async () => ({ homePlayers: [], awayPlayers: [] })),
    getTransfers: vi.fn(async () => []),
    getTransferHistory: vi.fn(async () => []),
    getPlayerTransferHistory: vi.fn(async () => [])
  };
  return {
    provider,
    mockGetTraining,
    mockGetCurrent,
    mockGetTrainingSummary,
    incomplete,
    training
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Sokker week 1217 regression", () => {
  it("requests the explicit week through HTTP and fills only omitted skills from that week", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { headers: { "set-cookie": "PHPSESSID=test" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(fixture.explicit)));
    vi.stubGlobal("fetch", mockFetch);
    const provider = new SokkerJsonApiProvider({ login: "test", password: "test" });
    const known = new Map(fixture.knownReportSkills.map((r) => [r.playerId, r.skills]));

    const parsed = await provider.getTraining(1217, known);

    expect(String(mockFetch.mock.calls[1]?.[0])).toBe("https://sokker.org/api/training?week=1217");
    expect(parsed.trainingWeeks.filter((week) => week.kind === "formation")).toHaveLength(12);
    expect(parsed.reportDiagnostics?.discardedReportReasons).toEqual([]);
    expect(parsed.players.map((p) => p.id)).not.toContain(40378797);
    expect(parsed.trainingWeeks.find((w) => w.playerId === 40378797)?.skills).toMatchObject(
      known.get(40378797)!
    );
  });

  it("rejects redacted skills without exact-week evidence and identifies the missing fields", () => {
    const known = new Map(fixture.knownReportSkills.map((r) => [r.playerId, r.skills]));

    const withoutEvidence = mapTrainingApiToTrainingData(fixture.explicit.players);
    const wrongWeek = mapTrainingApiToTrainingData(fixture.explicit.players, known, 1216);

    for (const parsed of [withoutEvidence, wrongWeek]) {
      expect(parsed.trainingWeeks.filter((w) => w.kind === "formation")).toHaveLength(11);
      expect(parsed.reportDiagnostics?.discardedReportReasons).toEqual([
        expect.objectContaining({
          playerId: 40378797,
          sourceWeekId: 1217,
          reason: "invalid_report",
          fields: expect.arrayContaining(["skills.stamina", "skills.pace"])
        })
      ]);
    }
  });

  it("bounds the complete retry operation to five minutes without persistence", async () => {
    vi.useFakeTimers();
    const mock = createMockProvider();
    mock.mockGetTraining.mockImplementation(() => new Promise(() => {}));
    const operation = loadValidatedSokkerSyncPayload(mock.provider).catch(
      (error: unknown) => error
    );

    await vi.advanceTimersByTimeAsync(300_000);
    const result = await operation;

    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toContain("five-minute retry window");
    expect(mock.mockGetTraining).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("recovers the twelfth formation report from the explicit week response", async () => {
    const mock = createMockProvider();
    expect(mock.incomplete.trainingWeeks.filter((w) => w.kind === "formation")).toHaveLength(11);

    const payload = await loadSokkerSyncPayload(mock.provider);
    const result = validateSokkerSyncPayload(payload);

    expect(mock.mockGetTraining).toHaveBeenCalledWith(1217, undefined);
    expect(payload.trainingWeeks.filter((w) => w.kind === "formation")).toHaveLength(12);
    expect(payload.trainingWeeks).toContainEqual(
      expect.objectContaining({ playerId: 40378797, gameWeek: 1217 })
    );
    expect(payload.players.map((p) => p.id)).not.toContain(40378797);
    expect(result.status).toBe("valid");
    // The visible screen changed to 9; the historical report retains Sokker's own week metadata.
    expect(payload.current.calendar).toMatchObject({ seasonWeek: 9, gameWeek: 1218 });
    expect(payload.requestedTrainingWeekId).toBe(1217);
    expect(payload.trainingWeeks[0]).toMatchObject({ gameWeek: 1217, seasonWeek: 8 });
  });

  it("accepts singular/list report formats and ignores identical stable IDs", () => {
    const source = fixture.explicit.players.map((p, index) =>
      index % 2 ? { ...p, report: [p.report] } : { ...p, report: undefined, reports: p.report }
    );
    source.push(source[0]!);

    const parsed = mapTrainingApiToTrainingData(
      source,
      new Map(fixture.knownReportSkills.map((r) => [r.playerId, r.skills])),
      1217
    );

    expect(parsed.trainingWeeks.filter((w) => w.kind === "formation")).toHaveLength(12);
    expect(parsed.trainingWeeks).toHaveLength(24);
    expect(parsed.reportDiagnostics?.discardedReportReasons).toEqual([
      { playerId: source[0]!.id, sourceWeekId: 1217, reason: "duplicate" }
    ]);
  });

  it("retries two inconsistent snapshots and allows persistence exactly once on the third", async () => {
    vi.useFakeTimers();
    const mock = createMockProvider();
    mock.mockGetTraining
      .mockResolvedValueOnce(mock.incomplete)
      .mockResolvedValueOnce(mock.incomplete);
    const mockPersist = vi.fn();
    const operation = loadValidatedSokkerSyncPayload(mock.provider).then((result) => {
      if (result.status === "valid") mockPersist(result);
      return result;
    });

    await vi.advanceTimersByTimeAsync(60_000);
    expect(mockPersist).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000);
    const result = await operation;

    expect(result.status).toBe("valid");
    expect(mockPersist).toHaveBeenCalledOnce();
    expect(mock.mockGetCurrent).toHaveBeenCalledTimes(3);
    expect(mock.mockGetTrainingSummary).toHaveBeenCalledTimes(3);
    expect(mock.mockGetTraining).toHaveBeenCalledTimes(3);
  });

  it("rejects three inconsistent snapshots without persistence and returns safe diagnostics", async () => {
    vi.useFakeTimers();
    const mock = createMockProvider();
    mock.mockGetTraining.mockResolvedValue(mock.incomplete);
    const mockPersist = vi.fn();
    const operation = loadValidatedSokkerSyncPayload(mock.provider).then((result) => {
      if (result.status === "valid") mockPersist(result);
      return result;
    });

    await vi.advanceTimersByTimeAsync(120_000);
    const result = await operation;

    expect(mockPersist).not.toHaveBeenCalled();
    expect(mock.mockGetTraining).toHaveBeenCalledTimes(3);
    expect(result.status).toBe("invalid");
    if (result.status !== "invalid") throw new Error("Expected rejection");
    expect(
      result.errors.find((e) => e.code === "SUMMARY_FORMATION_MISMATCH")?.details
    ).toMatchObject({
      visibleWeek: 9,
      sourceWeekId: 1217,
      summaryCount: 12,
      parsedCount: 11,
      attempt: 3,
      discardedReportReasons: [],
      receivedCount: 25
    });
    expect(JSON.stringify(result)).not.toMatch(/password|cookie|token|Lovelace/);
  });

  it("rejects malformed or conflicting duplicates even when counts match", async () => {
    const mock = createMockProvider();
    const first = fixture.explicit.players[0]!;
    mock.mockGetTraining.mockResolvedValue(
      mapTrainingApiToTrainingData([
        ...fixture.explicit.players,
        { ...first, report: { ...first.report, intensity: first.report.intensity + 1 } },
        { id: 99, report: null }
      ])
    );

    const result = validateSokkerSyncPayload(await loadSokkerSyncPayload(mock.provider));

    expect(result.status).toBe("invalid");
    if (result.status !== "invalid") throw new Error("Expected rejection");
    expect(result.errors.map((e) => e.code)).toContain("INVALID_SOURCE_TRAINING_REPORT");
  });
});
