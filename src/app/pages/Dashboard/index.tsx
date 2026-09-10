import { useMemo } from "react";
import type {
  ClubDashboardDevelopmentPlayer,
  ClubDashboardYouthPipelinePlayer,
  DashboardStatus,
  RealYouthAcademyPlayerPlan,
  Severity
} from "@atlas/web/app/types";
import type { DashboardProps } from "./types";
import { PlanningFocus } from "./PlanningFocus";
import { createSquadPriorityActionsViewModel } from "../Squad/squad-planning-view-model";

import { AttentionIcon } from "../../components/AttentionIcon";
import { PlayerLink } from "../../components/PlayerLink";

type Priority = "High" | "Medium" | "Low";

interface WatchPlayer {
  id: string;
  playerId: string | null;
  name: string;
  reasons: string[];
  severity: Severity;
}

interface AttentionItem {
  id: string;
  playerId: string | null;
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

export function Dashboard({
  dashboard,
  dashboardStatus,
  onSelectPlayer,
  youthAcademy,
  squadPlanning,
  squadPlanningStatus,
  financialStrategy
}: DashboardProps) {
  const attentionItems = dashboard ? buildAttentionItems(dashboard, youthAcademy) : [];
  const watchPlayers = dashboard ? buildWatchPlayers(dashboard, youthAcademy) : [];
  const planningActions = useMemo(
    () => (squadPlanning ? createSquadPriorityActionsViewModel(squadPlanning) : []),
    [squadPlanning]
  );

  return (
    <div className="atlas-dashboard">
      <header className="atlas-dashboard__header">
        <h1>Dashboard</h1>
      </header>

      <AttentionPanel
        items={attentionItems}
        onSelectPlayer={onSelectPlayer}
        status={dashboardStatus}
      />

      {squadPlanningStatus === "loading" ? (
        <PanelMessage>Loading squad planning...</PanelMessage>
      ) : null}
      {squadPlanningStatus === "error" ? (
        <PanelMessage tone="error">Squad planning is unavailable.</PanelMessage>
      ) : null}
      {squadPlanningStatus === "idle" ? (
        <PanelMessage>Squad planning data is not available yet.</PanelMessage>
      ) : null}
      {squadPlanningStatus === "ready" && squadPlanning ? (
        <PlanningFocus actions={planningActions} onSelectPlayer={onSelectPlayer} />
      ) : null}

      <FinancialStrategyAlerts
        onSelectPlayer={onSelectPlayer}
        financialStrategy={financialStrategy}
      />

      <PlayersToWatchPanel
        onSelectPlayer={onSelectPlayer}
        players={watchPlayers}
        status={dashboardStatus}
      />
    </div>
  );
}

function FinancialStrategyAlerts({
  financialStrategy,
  onSelectPlayer
}: {
  financialStrategy: DashboardProps["financialStrategy"];
  onSelectPlayer: (playerId: string) => void;
}) {
  const alerts = financialStrategy.viewModel?.criticalRecommendations ?? [];
  const hasMaterialPositionRisk = ["strained", "watch"].includes(
    financialStrategy.viewModel?.position.status ?? "unknown"
  );
  if (financialStrategy.status !== "ready" || (alerts.length === 0 && !hasMaterialPositionRisk)) {
    return null;
  }

  return (
    <section
      className="atlas-dashboard-panel atlas-dashboard-panel--financial"
      aria-labelledby="financial-strategy-alerts-title"
    >
      <div className="atlas-dashboard-panel__heading">
        <div>
          <span className="atlas-dashboard-planning__eyebrow">Financial strategy</span>
          <h2 id="financial-strategy-alerts-title" className="atlas-dashboard-panel__title">
            Capital priorities
          </h2>
        </div>
        <span className="atlas-dashboard-planning__quiet">
          {alerts.length} {alerts.length === 1 ? "priority" : "priorities"}
        </span>
      </div>
      {hasMaterialPositionRisk ? (
        <div
          className={
            "atlas-dashboard-financial-alert is-" + financialStrategy.viewModel?.position.status
          }
          role="status"
        >
          <span>Financial position</span>
          <strong>{financialStrategy.viewModel?.position.statusLabel}</strong>
        </div>
      ) : null}
      {alerts.length === 0 ? (
        <PanelMessage tone="success">No critical funding priorities detected.</PanelMessage>
      ) : (
        <div className="atlas-dashboard-financial-list">
          {alerts.slice(0, 4).map((alert) => (
            <article
              className={"atlas-dashboard-recommendation is-" + alert.priority.toLowerCase()}
              key={alert.id}
            >
              <div className="atlas-dashboard-recommendation__meta">
                <span
                  className={"atlas-dashboard-planning-badge is-" + alert.priority.toLowerCase()}
                >
                  {alert.priority}
                </span>
                <span>{alert.horizon}</span>
                <span>{alert.confidence} confidence</span>
              </div>
              <h3>{alert.title}</h3>
              <p>{alert.description}</p>
              {alert.financialImpact.length > 0 ? (
                <div className="atlas-dashboard-financial-impact">
                  {alert.financialImpact.map((impact) => (
                    <span key={impact}>{impact}</span>
                  ))}
                </div>
              ) : null}
              {alert.playerIds.length > 0 ? (
                <div className="atlas-dashboard-recommendation__players">
                  {alert.playerIds.map((playerId, index) => (
                    <PlayerLink
                      key={alert.id + "-" + playerId}
                      playerId={String(playerId)}
                      onSelectPlayer={onSelectPlayer}
                    >
                      {alert.playerNames[index] ?? "Player " + playerId}
                    </PlayerLink>
                  ))}
                </div>
              ) : null}
              {alert.reasons.length > 0 || alert.risks.length > 0 ? (
                <details>
                  <summary>Why this matters</summary>
                  <ul>
                    {alert.reasons.map((reason) => (
                      <li key={"reason-" + reason}>{reason}</li>
                    ))}
                    {alert.risks.map((risk) => (
                      <li key={"risk-" + risk}>{risk}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
interface AttentionPanelProps {
  items: AttentionItem[];
  onSelectPlayer: (playerId: string) => void;
  status: DashboardStatus;
}

function AttentionPanel({ items, onSelectPlayer, status }: AttentionPanelProps) {
  return (
    <section
      className="atlas-dashboard-panel atlas-dashboard-panel--attention"
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
        <ul className="atlas-dashboard-attention-list">
          {items.map((item) => (
            <li key={item.id} className={`atlas-dashboard-attention-item is-${item.severity}`}>
              <AttentionIcon severity={item.severity} />
              <span>
                {item.name ? (
                  <strong>
                    {item.playerId ? (
                      <PlayerLink playerId={item.playerId} onSelectPlayer={onSelectPlayer}>
                        {item.name}
                      </PlayerLink>
                    ) : (
                      item.name
                    )}
                  </strong>
                ) : null}
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
  onSelectPlayer: (playerId: string) => void;
  players: WatchPlayer[];
  status: DashboardStatus;
}

function PlayersToWatchPanel({ onSelectPlayer, players, status }: PlayersToWatchPanelProps) {
  return (
    <section className="atlas-dashboard-panel" aria-labelledby="players-to-watch-title">
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
        <div className="atlas-dashboard-watch-table" role="table" aria-label="Players to watch">
          <div className="atlas-dashboard-watch-row is-header" role="row">
            <span role="columnheader">Player</span>
            <span role="columnheader">Reason</span>
            <span role="columnheader">Priority</span>
          </div>
          {players.map((player) => (
            <div className="atlas-dashboard-watch-row" role="row" key={player.id}>
              <strong role="cell">
                {player.playerId ? (
                  <PlayerLink playerId={player.playerId} onSelectPlayer={onSelectPlayer}>
                    {player.name}
                  </PlayerLink>
                ) : (
                  player.name
                )}
              </strong>
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

interface PanelHeadingProps {
  id: string;
  title: string;
}

function PanelHeading({ id, title }: PanelHeadingProps) {
  return (
    <h2 id={id} className="atlas-dashboard-panel__title atlas-section-title">
      {title}
    </h2>
  );
}

interface PanelMessageProps {
  children: string;
  tone?: "error" | "success";
}

function PanelMessage({ children, tone }: PanelMessageProps) {
  return <p className={`atlas-dashboard-panel__message${tone ? ` is-${tone}` : ""}`}>{children}</p>;
}

interface PriorityBadgeProps {
  severity: Severity;
}

function PriorityBadge({ severity }: PriorityBadgeProps) {
  return (
    <span className={`atlas-dashboard-priority is-${severity}`}>
      {priorityFromSeverity(severity)}
    </span>
  );
}

function buildAttentionItems(
  dashboard: NonNullable<DashboardProps["dashboard"]>,
  youthAcademy: DashboardProps["youthAcademy"]
): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const player of dashboard.developmentSummary.inferred.highlightedPlayers) {
    if (player.signal === "improvement") {
      continue;
    }

    items.push({
      id: `development-${player.playerId ?? player.name}`,
      playerId: player.playerId,
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
      playerId: player.playerId,
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
      playerId: null,
      name: player.name,
      message: academyReason(player),
      severity: player.severity
    });
  }

  return items.sort(compareAttentionItems).slice(0, 5);
}

function buildWatchPlayers(
  dashboard: NonNullable<DashboardProps["dashboard"]>,
  youthAcademy: DashboardProps["youthAcademy"]
): WatchPlayer[] {
  const players = new Map<string, WatchPlayer>();

  for (const player of dashboard.developmentSummary.inferred.highlightedPlayers) {
    addWatchPlayer(players, {
      id: player.playerId ?? player.name.toLocaleLowerCase(),
      playerId: player.playerId,
      name: player.name,
      reasons: [developmentReason(player)],
      severity: player.severity
    });
  }

  for (const player of dashboard.youthPipelineSummary.inferred.highlightedPlayers) {
    addWatchPlayer(players, {
      id: player.playerId ?? player.name.toLocaleLowerCase(),
      playerId: player.playerId,
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
      playerId: null,
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
  existing.playerId ??= incoming.playerId;
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
