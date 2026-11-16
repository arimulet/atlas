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
  const completed = history.filter((report) => {
    const date = Date.parse(report.date);
    return Number.isFinite(date) && date <= asOf.getTime();
  });
  const latestWeek = completed.reduce<number | null>(
    (latest, report) => Math.max(latest ?? report.gameWeek, report.gameWeek),
    null
  );
  return latestWeek === null ? [] : completed.filter((report) => report.gameWeek === latestWeek);
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
