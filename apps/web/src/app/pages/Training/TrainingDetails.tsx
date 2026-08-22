import { calculateWeeklyTrainingPointsByKind } from "@atlas/domain";
import type { TrainingReport } from "@atlas/web/app/types";
import { formatEta, formatNumber, formatPercentage } from "../../formatters";
import { PLAYER_SKILL_DEFINITIONS, type PlayerSkillKey } from "../../view-models/player-skills";
import type { TrainingPlayerRow } from "../../view-models/training-view-model";

interface TrainingDetailsProps {
  history: TrainingReport[];
  player: Pick<TrainingPlayerRow, "etaWeeks" | "nextSkillUp" | "progress" | "trainingType">;
}

export function TrainingDetails({ history, player }: TrainingDetailsProps) {
  const seasons = groupReportsBySeason(history);

  if (seasons.length === 0) {
    return <p className="atlas-training-player-detail__message">No training history available.</p>;
  }

  return (
    <div className="atlas-training-details__table-wrap">
      <table className="atlas-training-details">
        <colgroup>
          <col className="is-season" />
          {PLAYER_SKILL_DEFINITIONS.map((skill) => (
            <col className="is-skill" key={skill.key} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Age</th>
            {PLAYER_SKILL_DEFINITIONS.map((skill) => (
              <th key={skill.key} scope="col">
                {skill.shortLabel}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {seasons.map((season, index) => (
            <tr key={season.key}>
              <th scope="row">{season.age ?? "—"}</th>
              {PLAYER_SKILL_DEFINITIONS.map((skill) => (
                <SeasonSkillCell
                  isLatestSeason={index === seasons.length - 1}
                  key={skill.key}
                  player={player}
                  reports={season.reports}
                  skill={skill.key}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface SeasonSkillCellProps {
  isLatestSeason: boolean;
  player: TrainingDetailsProps["player"];
  reports: TrainingReport[];
  skill: PlayerSkillKey;
}

function SeasonSkillCell({ isLatestSeason, player, reports, skill }: SeasonSkillCellProps) {
  const isActiveSkill = trainingSkillKey(player.trainingType) === skill;

  return (
    <td className={isActiveSkill && isLatestSeason ? "is-active-skill" : undefined}>
      <div className="atlas-training-details__level-groups">
        {groupReportsBySkillLevel(reports, skill).map((group) => (
          <div className="atlas-training-details__level-group" key={group.key}>
            <span className="atlas-training-details__level">L{group.level ?? "—"}</span>
            <div className="atlas-training-details__sessions">
              {group.reports.map((report) => (
                <TrainingSessionMark
                  isDirectTraining={trainingSkillKey(report.type) === skill}
                  key={report.gameWeek}
                  report={report}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {isActiveSkill && isLatestSeason ? <SkillProjection player={player} /> : null}
    </td>
  );
}

function TrainingSessionMark({
  isDirectTraining,
  report
}: {
  isDirectTraining: boolean;
  report: TrainingReport;
}) {
  const state = isDirectTraining
    ? report.kind === "missing"
      ? "idle"
      : report.kind
    : report.intensity > 0
      ? "residual"
      : "idle";
  const effectiveness = isDirectTraining ? effectivePoints(report) : report.intensity;
  const percentage = Math.max(0, Math.min(100, effectiveness));
  const description = isDirectTraining
    ? `Week ${report.seasonWeek} · ${formatEffectiveness(report)} effective training points`
    : state === "residual"
      ? `Week ${report.seasonWeek} · residual training from ${report.type}`
      : `Week ${report.seasonWeek} · no training`;

  return (
    <span className={`atlas-training-details__session is-${state}`} title={description}>
      <small>W{report.seasonWeek}</small>
      <span aria-hidden="true" className="atlas-training-details__session-bar">
        <span style={{ width: `${percentage}%` }} />
      </span>
      {isDirectTraining && state !== "idle" ? <strong>{formatEffectiveness(report)}</strong> : null}
    </span>
  );
}
function SkillProjection({ player }: { player: TrainingDetailsProps["player"] }) {
  if (player.progress === null && player.nextSkillUp === null) return null;

  return (
    <div className="atlas-training-details__projection">
      {player.progress !== null ? (
        <div className="atlas-training-details__progress">
          <span>{formatPercentage(player.progress)}</span>
          <span aria-hidden="true" className="atlas-training-details__progress-bar">
            <span style={{ width: `${Math.max(0, Math.min(100, player.progress))}%` }} />
          </span>
        </div>
      ) : null}
      <span>
        {formatNumber(player.nextSkillUp)} · {formatEta(player.etaWeeks)}
      </span>
    </div>
  );
}

function groupReportsBySeason(history: TrainingReport[]): Array<{
  key: string;
  age: number | null;
  reports: TrainingReport[];
}> {
  const seasons = new Map<string, TrainingReport[]>();

  for (const report of [...history].sort((left, right) => right.gameWeek - left.gameWeek)) {
    const key =
      report.season === null || report.season === undefined ? "unknown" : String(report.season);
    const reports = seasons.get(key) ?? [];
    reports.push(report);
    seasons.set(key, reports);
  }

  return [...seasons].map(([key, reports]) => ({
    key,
    age: reports[0]?.age ?? null,
    reports
  }));
}

function groupReportsBySkillLevel(
  reports: TrainingReport[],
  skill: PlayerSkillKey
): Array<{ key: string; level: number | undefined; reports: TrainingReport[] }> {
  return reports.reduce<
    Array<{ key: string; level: number | undefined; reports: TrainingReport[] }>
  >((groups, report) => {
    const level = skillLevel(report, skill);
    const current = groups.at(-1);

    if (current && current.level === level) {
      current.reports.push(report);
      return groups;
    }

    groups.push({ key: `${report.gameWeek}-${level ?? "unknown"}`, level, reports: [report] });
    return groups;
  }, []);
}
function formatEffectiveness(report: TrainingReport): string {
  return formatNumber(effectivePoints(report));
}

function effectivePoints(report: TrainingReport): number {
  if (report.kind === "missing") return 0;

  return calculateWeeklyTrainingPointsByKind({ intensity: report.intensity, kind: report.kind });
}
function skillLevel(report: TrainingReport, skill: PlayerSkillKey): number | undefined {
  const trainingSkill =
    skill === "defender" ? "defending" : skill === "playmaker" ? "playmaking" : skill;
  return report.skills[trainingSkill] ?? report.skills[skill];
}
function trainingSkillKey(trainingType: string | null): PlayerSkillKey | null {
  if (trainingType === "defending") return "defender";
  if (trainingType === "playmaking") return "playmaker";
  if (
    trainingType === "stamina" ||
    trainingType === "keeper" ||
    trainingType === "passing" ||
    trainingType === "technique" ||
    trainingType === "striker" ||
    trainingType === "pace"
  ) {
    return trainingType;
  }

  return null;
}
