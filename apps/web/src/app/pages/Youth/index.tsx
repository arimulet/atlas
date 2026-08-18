import type { DashboardStatus, RealYouthAcademyPlanning } from "@atlas/web/app/types";
import {
  createYouthAttentionItems,
  createYouthPlayerRows,
  type YouthAttentionItem,
  type YouthPlayerRow
} from "@atlas/web/app/view-models/youth-view-model";
import type { YouthProps } from "./types";
import { formatPercentage } from "../../formatters";
import { AttentionIcon } from "../../components/AttentionIcon";

export function Youth({ youthAcademy, youthStatus }: YouthProps) {
  const rows = createYouthPlayerRows(youthAcademy);
  const attentionItems = createYouthAttentionItems(youthAcademy);

  return (
    <div className="atlas-youth">
      <header className="atlas-youth__header">
        <h1>Youth</h1>
      </header>

      <YouthAttention items={attentionItems} status={youthStatus} />
      <YouthPlayers rows={rows} status={youthStatus} planning={youthAcademy} />
    </div>
  );
}

interface YouthAttentionProps {
  items: YouthAttentionItem[];
  status: DashboardStatus;
}

function YouthAttention({ items, status }: YouthAttentionProps) {
  return (
    <section
      className="atlas-youth-panel atlas-youth-panel--attention"
      aria-labelledby="youth-attention-title"
    >
      <h2 id="youth-attention-title" className="atlas-youth-panel__title atlas-section-title">
        Youth Attention
      </h2>
      {status === "loading" ? (
        <p className="atlas-youth-panel__message">Loading youth players...</p>
      ) : null}
      {status === "error" ? (
        <p className="atlas-youth-panel__message is-error">Unable to load youth players.</p>
      ) : null}
      {status === "idle" ? (
        <p className="atlas-youth-panel__message">No youth issues requiring attention.</p>
      ) : null}
      {status === "ready" && items.length === 0 ? (
        <p className="atlas-youth-panel__message is-clear">✓ No youth issues requiring attention</p>
      ) : null}
      {status === "ready" && items.length > 0 ? (
        <ul className="atlas-youth-attention-list">
          {items.map((item) => (
            <YouthAttentionItemView item={item} key={item.id} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

interface YouthAttentionItemViewProps {
  item: YouthAttentionItem;
}

function YouthAttentionItemView({ item }: YouthAttentionItemViewProps) {
  return (
    <li className={`atlas-youth-attention-item is-${item.severity}`}>
      <AttentionIcon severity={item.severity} />
      <span>
        {item.playerName ? <strong>{item.playerName}</strong> : null}
        {item.playerName ? " · " : null}
        {item.message}
      </span>
    </li>
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
        Youth Players
      </h2>
      <div className="atlas-youth-table-wrap">
        <table className="atlas-youth-table">
          <colgroup>
            <col className="atlas-youth-table__player-column" />
            <col className="atlas-youth-table__age-column" />
            <col className="atlas-youth-table__position-column" />
            <col className="atlas-youth-table__level-column" />
            <col className="atlas-youth-table__weeks-column" />
            <col className="atlas-youth-table__progress-column" />
            <col className="atlas-youth-table__promotion-column" />
            <col className="atlas-youth-table__status-column" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Player</th>
              <th scope="col">Age</th>
              <th scope="col">Position</th>
              <th scope="col">Current Level</th>
              <th scope="col">Weeks Left</th>
              <th scope="col">Progress</th>
              <th scope="col">Promotion</th>
              <th scope="col">Status</th>
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
      <td className="atlas-youth-table__empty" colSpan={8}>
        {message}
      </td>
    </tr>
  );
}

function YouthPlayerTableRow({ row }: { row: YouthPlayerRow }) {
  return (
    <tr>
      <th scope="row">{row.name}</th>
      <td className="atlas-youth-table__center">{row.age}</td>
      <td className="atlas-youth-table__center">{row.position ?? "—"}</td>
      <td>{formatLevel(row.level)}</td>
      <td className="atlas-youth-table__center">{row.weeksLeft ?? "—"}</td>
      <td className="atlas-youth-table__center">{formatProgress(row.progress)}</td>
      <td className="atlas-youth-table__center">{row.promotion ?? "—"}</td>
      <td>
        <span
          className={`atlas-youth-status${row.status ? ` is-${statusClass(row.status)}` : " is-empty"}`}
        >
          {row.status ?? "—"}
        </span>
      </td>
    </tr>
  );
}

function formatLevel(level: YouthPlayerRow["level"]): string {
  if (level === null) {
    return "—";
  }

  return level.label === null ? String(level.value) : `${level.value} · ${level.label}`;
}

function formatProgress(progress: number | null): string {
  return formatPercentage(progress);
}

function statusClass(status: NonNullable<YouthPlayerRow["status"]>): string {
  return status.toLowerCase().replaceAll(" ", "-");
}
