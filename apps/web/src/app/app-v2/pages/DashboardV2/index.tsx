import type {
  ClubDashboardDevelopmentPlayer,
  ClubDashboardYouthPipelinePlayer,
  DashboardStatus,
  RealYouthAcademyPlayerPlan,
  Severity
} from "@atlas/web/app/types";
import type { DashboardV2Props } from "./types";

type Priority = "High" | "Medium" | "Low";

interface WatchPlayer {
  id: string;
  name: string;
  reasons: string[];
  severity: Severity;
}

interface AttentionItem {
  id: string;
  name: string | null;
  message: string;
  severity: Severity;
}

const severityOrder: Record<Severity, number> = {
  high: 4,
  medium: 3,
  low: 2,
  info: 1
};

export function DashboardV2({
  dashboard,
  dashboardStatus,
  youthAcademy,
  youthStatus
}: DashboardV2Props) {
  const attentionItems = dashboard ? buildAttentionItems(dashboard, youthAcademy) : [];
  const watchPlayers = dashboard ? buildWatchPlayers(dashboard, youthAcademy) : [];

  return (
    <div className="v2-dashboard">
      <header className="v2-dashboard__header">
        <h1>Dashboard</h1>
      </header>

      <AttentionPanel items={attentionItems} status={dashboardStatus} />

      <div className="v2-dashboard__main-grid">
        <PlayersToWatchPanel players={watchPlayers} status={dashboardStatus} />
        <TrainingSnapshot dashboard={dashboard} status={dashboardStatus} />
      </div>

      <YouthSnapshot youthAcademy={youthAcademy} status={youthStatus} />
    </div>
  );
}

interface AttentionPanelProps {
  items: AttentionItem[];
  status: DashboardStatus;
}

function AttentionPanel({ items, status }: AttentionPanelProps) {
  return (
    <section
      className="v2-dashboard-panel v2-dashboard-panel--attention"
      aria-labelledby="attention-title"
    >
      <PanelHeading id="attention-title" title="Attention" />
      {status === "loading" ? <PanelMessage>Loading dashboard...</PanelMessage> : null}
      {status === "error" ? (
        <PanelMessage tone="error">Unable to load dashboard data.</PanelMessage>
      ) : null}
      {status === "idle" ? (
        <PanelMessage>Import a club snapshot to populate the dashboard.</PanelMessage>
      ) : null}
      {status === "ready" && items.length === 0 ? (
        <PanelMessage tone="success">✓ No critical issues detected</PanelMessage>
      ) : null}
      {status === "ready" && items.length > 0 ? (
        <ul className="v2-dashboard-attention-list">
          {items.map((item) => (
            <li key={item.id} className={`v2-dashboard-attention-item is-${item.severity}`}>
              <span className="v2-dashboard-attention-item__icon" aria-hidden="true">
                {item.severity === "info" || item.severity === "low" ? "i" : "!"}
              </span>
              <span>
                {item.name ? <strong>{item.name}</strong> : null}
                {item.name ? " — " : null}
                {item.message}
              </span>
              <PriorityBadge severity={item.severity} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

interface PlayersToWatchPanelProps {
  players: WatchPlayer[];
  status: DashboardStatus;
}

function PlayersToWatchPanel({ players, status }: PlayersToWatchPanelProps) {
  return (
    <section className="v2-dashboard-panel" aria-labelledby="players-to-watch-title">
      <PanelHeading id="players-to-watch-title" title="Players to Watch" />
      {status === "loading" ? <PanelMessage>Loading player signals...</PanelMessage> : null}
      {status === "error" ? (
        <PanelMessage tone="error">Player signals are unavailable.</PanelMessage>
      ) : null}
      {status === "idle" ? (
        <PanelMessage>Import a club snapshot to identify player signals.</PanelMessage>
      ) : null}
      {status === "ready" && players.length === 0 ? (
        <PanelMessage tone="success">✓ No players currently require attention</PanelMessage>
      ) : null}
      {status === "ready" && players.length > 0 ? (
        <div className="v2-dashboard-watch-table" role="table" aria-label="Players to watch">
          <div className="v2-dashboard-watch-row is-header" role="row">
            <span role="columnheader">Player</span>
            <span role="columnheader">Reason</span>
            <span role="columnheader">Priority</span>
          </div>
          {players.map((player) => (
            <div className="v2-dashboard-watch-row" role="row" key={player.id}>
              <strong role="cell">{player.name}</strong>
              <span role="cell">{player.reasons.join(" · ")}</span>
              <span role="cell">
                <PriorityBadge severity={player.severity} />
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

interface TrainingSnapshotProps {
  dashboard: DashboardV2Props["dashboard"];
  status: DashboardStatus;
}

function TrainingSnapshot({ dashboard, status }: TrainingSnapshotProps) {
  const summary = dashboard?.trainingSummary;

  return (
    <section
      className="v2-dashboard-panel v2-dashboard-panel--compact"
      aria-labelledby="training-title"
    >
      <PanelHeading id="training-title" title="Training" />
      {status === "loading" ? <PanelMessage>Loading training data...</PanelMessage> : null}
      {status === "error" ? (
        <PanelMessage tone="error">Training data is unavailable.</PanelMessage>
      ) : null}
      {status === "idle" ? (
        <PanelMessage>Import a club snapshot to inspect training.</PanelMessage>
      ) : null}
      {status === "ready" && !summary?.available ? (
        <PanelMessage>No training data available.</PanelMessage>
      ) : null}
      {status === "ready" && summary?.available ? (
        <>
          <dl className="v2-dashboard-metric-list">
            <MetricRow label="Advanced training" value={summary.observed.advancedPlayers} />
            <MetricRow label="Formation training" value={summary.observed.formationPlayers} />
            <MetricRow label="Players observed" value={summary.observed.playersWithTrainingData} />
          </dl>
          <p className="v2-dashboard-panel__note">
            Efficiency and skill-up history are not available in the current snapshot model.
          </p>
        </>
      ) : null}
    </section>
  );
}

interface YouthSnapshotProps {
  youthAcademy: DashboardV2Props["youthAcademy"];
  status: DashboardStatus;
}

function YouthSnapshot({ youthAcademy, status }: YouthSnapshotProps) {
  const plans = youthAcademy?.derived.players ?? [];
  const attentionCount = plans.filter(
    (player) => player.category === "ready_for_promotion" || player.category === "stagnation_risk"
  ).length;
  const standoutProspectCount = plans.filter(
    (player) => player.category === "standout_prospect"
  ).length;

  return (
    <section className="v2-dashboard-panel v2-dashboard-panel--youth" aria-labelledby="youth-title">
      <PanelHeading id="youth-title" title="Youth" />
      {status === "loading" ? <PanelMessage>Loading youth data...</PanelMessage> : null}
      {status === "error" ? (
        <PanelMessage tone="error">Unable to load youth data.</PanelMessage>
      ) : null}
      {status === "idle" ? (
        <PanelMessage>Import a club snapshot to inspect the academy.</PanelMessage>
      ) : null}
      {status === "ready" && !youthAcademy?.snapshotId ? (
        <PanelMessage>No youth data available.</PanelMessage>
      ) : null}
      {status === "ready" && youthAcademy?.snapshotId ? (
        <dl className="v2-dashboard-metric-list v2-dashboard-metric-list--youth">
          <MetricRow label="Players" value={youthAcademy.observed.coverage.totalYouthCount} />
          <MetricRow label="Need attention" value={attentionCount} />
          {standoutProspectCount > 0 ? (
            <MetricRow label="Standout prospects" value={standoutProspectCount} />
          ) : null}
        </dl>
      ) : null}
    </section>
  );
}

interface PanelHeadingProps {
  id: string;
  title: string;
}

function PanelHeading({ id, title }: PanelHeadingProps) {
  return (
    <h2 id={id} className="v2-dashboard-panel__title">
      {title}
    </h2>
  );
}

interface PanelMessageProps {
  children: string;
  tone?: "error" | "success";
}

function PanelMessage({ children, tone }: PanelMessageProps) {
  return <p className={`v2-dashboard-panel__message${tone ? ` is-${tone}` : ""}`}>{children}</p>;
}

interface MetricRowProps {
  label: string;
  value: number;
}

function MetricRow({ label, value }: MetricRowProps) {
  return (
    <div className="v2-dashboard-metric-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

interface PriorityBadgeProps {
  severity: Severity;
}

function PriorityBadge({ severity }: PriorityBadgeProps) {
  return (
    <span className={`v2-dashboard-priority is-${severity}`}>{priorityFromSeverity(severity)}</span>
  );
}

function buildAttentionItems(
  dashboard: NonNullable<DashboardV2Props["dashboard"]>,
  youthAcademy: DashboardV2Props["youthAcademy"]
): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const player of dashboard.developmentSummary.inferred.highlightedPlayers) {
    if (player.signal === "improvement") {
      continue;
    }

    items.push({
      id: `development-${player.playerId ?? player.name}`,
      name: player.name,
      message: developmentReason(player),
      severity: player.severity
    });
  }

  for (const player of dashboard.youthPipelineSummary.inferred.highlightedPlayers) {
    if (player.signal === "standout_prospect") {
      continue;
    }

    items.push({
      id: `youth-pipeline-${player.playerId ?? player.name}`,
      name: player.name,
      message: youthPipelineReason(player),
      severity: player.severity
    });
  }

  for (const player of youthAcademy?.derived.players ?? []) {
    if (player.category !== "ready_for_promotion" && player.category !== "stagnation_risk") {
      continue;
    }

    items.push({
      id: `academy-${player.id}`,
      name: player.name,
      message: academyReason(player),
      severity: player.severity
    });
  }

  return items.sort(compareAttentionItems).slice(0, 5);
}

function buildWatchPlayers(
  dashboard: NonNullable<DashboardV2Props["dashboard"]>,
  youthAcademy: DashboardV2Props["youthAcademy"]
): WatchPlayer[] {
  const players = new Map<string, WatchPlayer>();

  for (const player of dashboard.developmentSummary.inferred.highlightedPlayers) {
    addWatchPlayer(players, {
      id: player.playerId ?? player.name.toLocaleLowerCase(),
      name: player.name,
      reasons: [developmentReason(player)],
      severity: player.severity
    });
  }

  for (const player of dashboard.youthPipelineSummary.inferred.highlightedPlayers) {
    addWatchPlayer(players, {
      id: player.playerId ?? player.name.toLocaleLowerCase(),
      name: player.name,
      reasons: [youthPipelineReason(player)],
      severity: player.severity
    });
  }

  for (const player of youthAcademy?.derived.players ?? []) {
    if (player.category === "follow_up" || player.category === "insufficient_data") {
      continue;
    }

    addWatchPlayer(players, {
      id: player.id,
      name: player.name,
      reasons: [academyReason(player)],
      severity: player.severity
    });
  }

  return [...players.values()].sort(compareWatchPlayers).slice(0, 8);
}

function addWatchPlayer(players: Map<string, WatchPlayer>, incoming: WatchPlayer) {
  const existing = players.get(incoming.id);

  if (!existing) {
    players.set(incoming.id, incoming);
    return;
  }

  existing.reasons = [...new Set([...existing.reasons, ...incoming.reasons])];
  if (severityOrder[incoming.severity] > severityOrder[existing.severity]) {
    existing.severity = incoming.severity;
  }
}

function compareAttentionItems(left: AttentionItem, right: AttentionItem) {
  return (
    severityOrder[right.severity] - severityOrder[left.severity] ||
    (left.name ?? "").localeCompare(right.name ?? "")
  );
}

function compareWatchPlayers(left: WatchPlayer, right: WatchPlayer) {
  return (
    severityOrder[right.severity] - severityOrder[left.severity] ||
    left.name.localeCompare(right.name)
  );
}

function developmentReason(player: ClubDashboardDevelopmentPlayer) {
  const reasons: Record<ClubDashboardDevelopmentPlayer["signal"], string> = {
    improvement: "Development improving",
    stagnation: "Development stagnation",
    decline: "Development decline",
    insufficient_data: "Insufficient development data"
  };

  return reasons[player.signal];
}

function youthPipelineReason(player: ClubDashboardYouthPipelinePlayer) {
  const reasons: Record<ClubDashboardYouthPipelinePlayer["signal"], string> = {
    standout_prospect: "Youth prospect",
    follow_up: "Youth follow-up",
    stagnation_risk: "Youth stagnation risk",
    insufficient_data: "Insufficient youth data"
  };

  return reasons[player.signal];
}

function academyReason(player: RealYouthAcademyPlayerPlan) {
  const reasons: Record<RealYouthAcademyPlayerPlan["category"], string> = {
    standout_prospect: "Youth prospect",
    ready_for_promotion: "Ready for promotion",
    follow_up: "Youth follow-up",
    stagnation_risk: "Youth stagnation risk",
    insufficient_data: "Insufficient youth data"
  };

  return reasons[player.category];
}

function priorityFromSeverity(severity: Severity): Priority {
  if (severity === "high") return "High";
  if (severity === "medium") return "Medium";
  return "Low";
}
