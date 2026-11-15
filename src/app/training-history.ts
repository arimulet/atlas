import type { TrainingReport } from "./types";

export function isProcessedTrainingReport(
  report: Pick<TrainingReport, "kind" | "intensity">
): boolean {
  return report.kind !== "missing" && report.intensity > 0;
}
