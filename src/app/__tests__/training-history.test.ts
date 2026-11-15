import { describe, expect, it } from "vitest";

import { isProcessedTrainingReport } from "../training-history";

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
