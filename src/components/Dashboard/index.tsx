import { useMemo, type ReactNode } from "react";
import { Check } from "lucide-react";
import type {
  ClubDashboardDevelopmentPlayer,
  ClubDashboardYouthPipelinePlayer,
  DashboardStatus,
  RealYouthAcademyPlayerPlan,
  Severity
} from "@atlas/web/app/types";
import type { DashboardProps } from "./types";
import { ActionQueuePanel } from "./ActionQueuePanel";
import { createActionQueueItems } from "./action-queue-view-model";
import { SquadPlanningSections, planningConfidenceWarning } from "../Squad/SquadPlanningSections";
import { createSquadPlanningViewModel } from "../Squad/squad-planning-view-model";
import { CountryNameFlag } from "@/components/CountryNameFlag";
import { PlayerLink } from "@/components/PlayerLink";
import { registerPlayerCountries } from "@/context/PlayerCountryContext";

type Priority = "High" | "Medium" | "Low";

interface WatchPlayer {
  id: string;
  playerId: string | null;
  name: string;
  countryName?: string | null;
  reasons: string[];
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
  onNavigateToView,
  onSelectPlayer,
  youthAcademy,
  squadPlanning,
  squadPlanningStatus,
  financialStrategy
}: DashboardProps) {
  if (squadPlanning?.assessment?.depthPlayers) {
    registerPlayerCountries(squadPlanning.assessment.depthPlayers);
  }

  const watchPlayers = dashboard ? buildWatchPlayers(dashboard, youthAcademy) : [];
  const planningViewModel = useMemo(
    () => (squadPlanning ? createSquadPlanningViewModel(squadPlanning) : null),
    [squadPlanning]
  );
  const actionQueueItems = useMemo(
    () =>
      createActionQueueItems({
        squadPlanning,
        financialRecommendations: financialStrategy.viewModel?.recommendations ?? []
      }),
    [financialStrategy.viewModel?.recommendations, squadPlanning]
  );

  return (
    <div className="atlas-dashboard">
      <header className="atlas-dashboard__header">
        <h1>Insights</h1>
      </header>

      <ActionQueuePanel
        financialStatus={financialStrategy.status}
        items={actionQueueItems}
        onNavigateToView={onNavigateToView}
        onSelectPlayer={onSelectPlayer}
        squadStatus={squadPlanningStatus}
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
      {squadPlanningStatus === "ready" && planningViewModel ? (
        <>
          <SquadPlanningSections onSelectPlayer={onSelectPlayer} viewModel={planningViewModel} />
          {planningConfidenceWarning(planningViewModel) ? (
            <PanelMessage tone="quiet">{planningConfidenceWarning(planningViewModel)}</PanelMessage>
          ) : null}
        </>
      ) : null}

      <PlayersToWatchPanel
        onSelectPlayer={onSelectPlayer}
        players={watchPlayers}
        status={dashboardStatus}
      />
    </div>
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
        <PanelMessage tone="success">
          <Check size={14} className="inline-block align-middle" /> No players currently require
          attention
        </PanelMessage>
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
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    {player.countryName ? (
                      <CountryNameFlag countryName={player.countryName} />
                    ) : null}
                    <span>{player.name}</span>
                  </span>
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
  children: ReactNode;
  tone?: "error" | "success" | "quiet";
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
      countryName: player.countryName ?? null,
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
  existing.countryName ??= incoming.countryName;
  if (severityOrder[incoming.severity] > severityOrder[existing.severity]) {
    existing.severity = incoming.severity;
  }
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
