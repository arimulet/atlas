import { describe, expect, it } from "vitest";

import type { TrainingReport } from "../types";
import { isProcessedTrainingReport, latestCompletedTrainingReports } from "../training-history";

describe("isProcessedTrainingReport", () => {
  it("excludes a configured session that has not been processed yet", () => {
    expect(isProcessedTrainingReport({ kind: "formation", intensity: 0 })).toBe(false);
  });

  it("keeps processed formation and advanced sessions", () => {
    expect(isProcessedTrainingReport({ kind: "formation", intensity: 99 })).toBe(true);
    expect(isProcessedTrainingReport({ kind: "advanced", intensity: 100 })).toBe(true);
  });

  it("excludes missing reports", () => {
    expect(isProcessedTrainingReport({ kind: "missing", intensity: 0 })).toBe(false);
  });
});

describe("latestCompletedTrainingReports", () => {
  it("selects the latest completed week, including zero-intensity reports", () => {
    const history = [
      { playerId: 1, gameWeek: 1217, date: "2026-11-12", kind: "advanced", intensity: 100 },
      { playerId: 2, gameWeek: 1217, date: "2026-11-12", kind: "missing", intensity: 0 },
      { playerId: 1, gameWeek: 1218, date: "2026-11-19", kind: "formation", intensity: 0 },
      { playerId: 3, gameWeek: 1216, date: "2026-11-05", kind: "advanced", intensity: 100 }
    ] as TrainingReport[];

    const result = latestCompletedTrainingReports(history, new Date("2026-11-16T12:00:00Z"));

    expect(result.map((report) => report.playerId)).toEqual([1, 2]);
  });

  it("does not use an unprocessed week with only zero-intensity reports as completed", () => {
    const history = [
      { playerId: 1, gameWeek: 1218, date: "2026-11-19", kind: "advanced", intensity: 100 },
      { playerId: 2, gameWeek: 1218, date: "2026-11-19", kind: "formation", intensity: 99 },
      { playerId: 1, gameWeek: 1219, date: "2026-11-26", kind: "formation", intensity: 0 },
      { playerId: 2, gameWeek: 1219, date: "2026-11-26", kind: "formation", intensity: 0 }
    ] as TrainingReport[];

    // Even if today is the date of week 1219, it has not processed yet (all zero intensity)
    const result = latestCompletedTrainingReports(history, new Date("2026-11-26T12:00:00Z"));

    expect(result.map((report) => report.gameWeek)).toEqual([1218, 1218]);
  });

  it("does not use a future or undated report as the latest completed week", () => {
    const history = [
      { gameWeek: 1218, date: "2026-11-19" },
      { gameWeek: 1219, date: "invalid" }
    ] as TrainingReport[];

    expect(latestCompletedTrainingReports(history, new Date("2026-11-16T12:00:00Z"))).toEqual([]);
  });
});
