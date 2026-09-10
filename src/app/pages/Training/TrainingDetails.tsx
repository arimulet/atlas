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
  const sortedHistory = [...history].sort((left, right) => right.gameWeek - left.gameWeek);
  const seasons = groupReportsBySeason(sortedHistory);

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
                  allReports={sortedHistory}
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
  allReports: TrainingReport[];
  skill: PlayerSkillKey;
}

function SeasonSkillCell({ isLatestSeason, player, reports, allReports, skill }: SeasonSkillCellProps) {
  const isActiveSkill = trainingSkillKey(player.trainingType) === skill;

  return (
    <td className={isActiveSkill && isLatestSeason ? "is-active-skill" : undefined}>
      <div className="atlas-training-details__level-groups">
        {groupReportsBySkillLevel(reports, allReports, skill).map((group) => (
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
  const effectiveness = isDirectTraining ? effectivePoints(report) : report.intensity;
  const state = effectiveness <= 0 ? "idle" : isDirectTraining ? report.kind : "residual";
  const percentage = effectiveness <= 0 ? 100 : Math.max(0, Math.min(100, effectiveness));
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

  for (const report of history) {
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
  allReports: TrainingReport[],
  skill: PlayerSkillKey
): Array<{ key: string; level: number | undefined; reports: TrainingReport[] }> {
  const groups: Array<{ key: string; level: number | undefined; reports: TrainingReport[] }> = [];

  for (const report of reports) {
    const olderReport = allReports.find((r) => r.gameWeek < report.gameWeek);
    const levelBeforeTraining = olderReport ? skillLevel(olderReport, skill) : skillLevel(report, skill);
    const current = groups.at(-1);

    if (current && current.level === levelBeforeTraining) {
      current.reports.push(report);
    } else {
      groups.push({
        key: `${report.gameWeek}-${levelBeforeTraining ?? "unknown"}`,
        level: levelBeforeTraining,
        reports: [report]
      });
    }
  }

  if (reports.length > 0) {
    const newestReport = reports[0];
    if (newestReport) {
      const levelAfterTraining = skillLevel(newestReport, skill);

      if (levelAfterTraining !== undefined && levelAfterTraining !== groups[0]?.level) {
        groups.unshift({
          key: `ending-${newestReport.gameWeek}-${levelAfterTraining}`,
          level: levelAfterTraining,
          reports: []
        });
      }
    }
  }

  return groups;
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
