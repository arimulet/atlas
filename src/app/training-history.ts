import type { TrainingReport } from "./types";

export function isProcessedTrainingReport(
  report: Pick<TrainingReport, "kind" | "intensity">
): boolean {
  return report.kind !== "missing" && report.intensity > 0;
}

export function latestCompletedTrainingReports(
  history: readonly TrainingReport[],
  asOf: Date = new Date()
): TrainingReport[] {
  const eligibleReports = history.filter((report) => {
    const date = Date.parse(report.date);
    return Number.isFinite(date) && date <= asOf.getTime();
  });
  const processedWeeks = new Set(
    eligibleReports.filter(isProcessedTrainingReport).map((report) => report.gameWeek)
  );
  const targetWeeks = processedWeeks.size > 0 ? processedWeeks : null;
  const latestWeek = eligibleReports.reduce<number | null>(
    (latest, report) =>
      !targetWeeks || targetWeeks.has(report.gameWeek)
        ? Math.max(latest ?? report.gameWeek, report.gameWeek)
        : latest,
    null
  );
  return latestWeek === null ? [] : eligibleReports.filter((report) => report.gameWeek === latestWeek);
}

export function recordedTrainingSkillChanges(
  report: TrainingReport | null | undefined
): Array<{ skill: string; delta: number }> {
  if (!report) return [];

  const changes = new Map<string, number>();
  for (const [skill, delta] of Object.entries(report.skillsChange ?? {})) {
    if (skill !== "up" && skill !== "down" && Number.isFinite(delta) && delta !== 0) {
      changes.set(skill, delta);
    }
  }
  for (const change of report.skillChanges ?? []) {
    if (Number.isFinite(change.delta) && change.delta !== 0) {
      changes.set(change.skill, change.delta);
    }
  }
  return [...changes].map(([skill, delta]) => ({ skill, delta }));
}
