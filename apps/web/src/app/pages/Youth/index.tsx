import type { DashboardStatus, RealYouthAcademyPlanning } from "@atlas/web/app/types";
import {
  createYouthPlayerRows,
  type YouthPlayerRow
} from "@atlas/web/app/view-models/youth-view-model";
import type { YouthProps } from "./types";
import { AttentionIcon } from "../../components/AttentionIcon";
import { formatTalent } from "../../formatters";
import { skillLevelLabel } from "../../view-models/skill-level-label";
import { YouthSummary } from "./YouthDecisionSections";

export function Youth({ clubId, currency, youthAcademy, youthStatus }: YouthProps) {
  const rows = createYouthPlayerRows(youthAcademy);
  const schoolRows = rows.filter((row) => row.status !== "Promoted");

  return (
    <div className="atlas-youth">
      <header className="atlas-youth__header">
        <h1>Youth</h1>
      </header>
      <YouthSummary summary={{ academyPlayers: schoolRows.length }} />
      <YouthPlayers rows={schoolRows} status={youthStatus} planning={youthAcademy} />
    </div>
  );
}

interface YouthPlayersProps {
  planning: RealYouthAcademyPlanning | null;
  rows: YouthPlayerRow[];
  status: DashboardStatus;
}

function YouthPlayers({ planning, rows, status }: YouthPlayersProps) {
  return (
    <section
      className="atlas-youth-panel atlas-youth-panel--players"
      aria-labelledby="youth-players-title"
    >
      <h2 id="youth-players-title" className="atlas-youth-panel__title atlas-section-title">
        Youth School
      </h2>
      <div className="atlas-youth-table-wrap">
        <table className="atlas-youth-table">
          <colgroup>
            <col className="atlas-youth-table__player-column" />
            <col className="atlas-youth-table__age-column" />
            <col className="atlas-youth-table__level-column" />
            <col className="atlas-youth-table__weeks-column" />
            <col className="atlas-youth-table__expected-level-column" />
            <col className="atlas-youth-table__expected-age-column" />
            <col className="atlas-youth-table__initial-weeks-column" />
            <col className="atlas-youth-table__pops-column" />
            <col className="atlas-youth-table__talent-column" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Player</th>
              <th scope="col">Age</th>
              <th scope="col">Current Level</th>
              <th scope="col">Weeks Left</th>
              <th scope="col" title="Projected level at promotion, based on observed talent.">
                Expected Level
              </th>
              <th scope="col" title="Age projected at promotion.">
                Expected Age
              </th>
              <th scope="col">Initial Weeks</th>
              <th scope="col">Level Pops</th>
              <th scope="col" title="Average academy weeks per level pop. Lower is better.">
                Talent
              </th>
            </tr>
          </thead>
          <tbody>
            {status === "loading" ? <YouthTableMessage message="Loading youth players..." /> : null}
            {status === "error" ? (
              <YouthTableMessage message="Unable to load youth players." />
            ) : null}
            {status === "idle" ? <YouthTableMessage message="No youth players available." /> : null}
            {status === "ready" && planning?.snapshotId === null ? (
              <YouthTableMessage message="No youth players available." />
            ) : null}
            {status === "ready" && planning?.snapshotId !== null && rows.length === 0 ? (
              <YouthTableMessage message="No youth players available." />
            ) : null}
            {status === "ready" && planning?.snapshotId !== null
              ? rows.map((row) => <YouthPlayerTableRow key={row.id} row={row} />)
              : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function YouthTableMessage({ message }: { message: string }) {
  return (
    <tr>
      <td className="atlas-youth-table__empty" colSpan={9}>
        {message}
      </td>
    </tr>
  );
}

function YouthPlayerTableRow({ row }: { row: YouthPlayerRow }) {
  const skillChangeClass = changeClass(row.level?.change ?? null);

  return (
    <tr>
      <th scope="row">
        <span className="atlas-youth-table__player-name">
          <span className={`atlas-youth-table__player-name-value${skillChangeClass}`}>
            {row.name}
          </span>
          {row.attentions.map((attention) => (
            <span
              aria-label={attention.message}
              className="atlas-youth-player-attention"
              key={attention.id}
              role="img"
              title={attention.message}
            >
              <AttentionIcon severity={attention.severity} />
            </span>
          ))}
          {row.status !== null && row.status !== "In academy" && row.status !== "Attention" ? (
            <span className={`atlas-youth-player-indicator is-${statusClass(row.status)}`}>
              {row.status}
            </span>
          ) : null}
        </span>
      </th>
      <td className="atlas-youth-table__center">{row.age}</td>
      <td>
        <span className="atlas-youth-skill-level">
          <span className={`atlas-youth-skill-level__value${skillChangeClass}`}>
            {formatLevel(row.level)}
          </span>
          <SkillChangeIndicator change={row.level?.change ?? null} />
        </span>
      </td>
      <td className="atlas-youth-table__center">{row.weeksLeft ?? "—"}</td>
      <td>{formatLevelValue(row.expectedLevel)}</td>
      <td className="atlas-youth-table__center">{row.expectedAge ?? "—"}</td>
      <td className="atlas-youth-table__center">{row.initialWeeks ?? "—"}</td>
      <td className="atlas-youth-table__center">{formatLevelPops(row.levelPops)}</td>
      <td className="atlas-youth-table__center">{formatYouthTalent(row.talent)}</td>
    </tr>
  );
}

function formatLevel(level: YouthPlayerRow["level"]): string {
  return level === null ? "—" : formatLevelValue(level.value);
}

function formatLevelValue(level: number | null): string {
  return level === null ? "—" : `${skillLevelLabel(level)} [${level}]`;
}

function formatLevelPops(levelPops: number | null): string {
  return levelPops === null ? "—" : `+${levelPops}`;
}

function formatYouthTalent(talent: number | null): string {
  return formatTalent(talent);
}

function changeClass(change: number | null): string {
  if (change === null || change === 0) {
    return "";
  }

  return ` is-${change > 0 ? "up" : "down"}`;
}

function SkillChangeIndicator({ change }: { change: number | null }) {
  if (change === null || change === 0) {
    return null;
  }

  const isIncrease = change > 0;

  return (
    <span className={`atlas-youth-skill-change is-${isIncrease ? "up" : "down"}`}>
      {isIncrease ? "↑" : "↓"} {isIncrease ? "+" : ""}
      {change}
    </span>
  );
}

function statusClass(status: NonNullable<YouthPlayerRow["status"]>): string {
  return status.toLowerCase().replaceAll(" ", "-");
}
