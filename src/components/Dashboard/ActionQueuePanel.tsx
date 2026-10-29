import { useState } from "react";
import type { DashboardStatus } from "@/app/types";
import type { FinancialStrategyState } from "@/app/features/financialStrategy/useFinancialStrategy";
import { PlayerLink } from "@/components/PlayerLink";
import {
  ACTION_QUEUE_INITIAL_LIMIT,
  groupActionQueueItems,
  visibleActionQueueItems,
  type ActionQueueDestination,
  type ActionQueueItem,
  type ActionQueueView
} from "./action-queue-view-model";

interface ActionQueuePanelProps {
  items: readonly ActionQueueItem[];
  squadStatus: DashboardStatus;
  financialStatus: FinancialStrategyState["status"];
  onSelectPlayer: (playerId: string) => void;
  onNavigateToView: (view: ActionQueueView) => void;
}

const HORIZON_LABELS = {
  current: "Now",
  next_season: "Next season",
  medium_term: "Medium term"
} as const;

export function ActionQueuePanel({
  items,
  squadStatus,
  financialStatus,
  onSelectPlayer,
  onNavigateToView
}: ActionQueuePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const visibleItems = visibleActionQueueItems(items, isExpanded);
  const groups = groupActionQueueItems(visibleItems);
  const isLoading = squadStatus === "loading" || financialStatus === "loading";
  const unavailableSources = [
    squadStatus === "error" ? "squad planning" : null,
    financialStatus === "error" ? "financial strategy" : null
  ].filter((source): source is string => source !== null);
  const hasAvailableSource = squadStatus === "ready" || financialStatus === "ready";
  const hiddenCount = Math.max(0, items.length - ACTION_QUEUE_INITIAL_LIMIT);

  return (
    <section
      className="atlas-dashboard-panel atlas-action-queue"
      aria-labelledby="action-queue-title"
    >
      <div className="atlas-dashboard-panel__heading">
        <div>
          <span className="atlas-dashboard-planning__eyebrow">Decision support</span>
          <h2 id="action-queue-title" className="atlas-dashboard-panel__title">
            Action queue
          </h2>
        </div>
        <span className="atlas-dashboard-planning__quiet" aria-live="polite">
          {items.length} {items.length === 1 ? "active action" : "active actions"}
        </span>
      </div>

      {items.length > 0 ? (
        <div className="atlas-action-queue__groups">
          {groups.map((group) => (
            <section className="atlas-action-queue__group" key={group.horizon}>
              <h3>{HORIZON_LABELS[group.horizon]}</h3>
              <div className="atlas-action-queue__list">
                {group.items.map((item) => (
                  <ActionQueueCard
                    item={item}
                    key={item.id}
                    onNavigateToView={onNavigateToView}
                    onSelectPlayer={onSelectPlayer}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : isLoading ? (
        <p className="atlas-dashboard-panel__message">Loading action queue...</p>
      ) : hasAvailableSource ? (
        <p className="atlas-dashboard-panel__message is-success">No active actions.</p>
      ) : (
        <p className="atlas-dashboard-panel__message">Action queue data is not available yet.</p>
      )}

      {unavailableSources.length > 0 ? (
        <p className="atlas-dashboard-panel__message is-error" role="status">
          {unavailableSources.join(" and ")} {unavailableSources.length === 1 ? "is" : "are"}{" "}
          unavailable.
        </p>
      ) : null}

      {items.length > ACTION_QUEUE_INITIAL_LIMIT ? (
        <button
          aria-expanded={isExpanded}
          className="atlas-action-queue__toggle"
          onClick={() => setIsExpanded((current) => !current)}
          type="button"
        >
          {isExpanded ? "Show top actions" : `View all actions (${hiddenCount} more)`}
        </button>
      ) : null}
    </section>
  );
}

interface ActionQueueCardProps {
  item: ActionQueueItem;
  onSelectPlayer: (playerId: string) => void;
  onNavigateToView: (view: ActionQueueView) => void;
}

function ActionQueueCard({ item, onSelectPlayer, onNavigateToView }: ActionQueueCardProps) {
  const handleOpenDestination = () => {
    openActionDestination(item.destination, onSelectPlayer, onNavigateToView);
  };

  return (
    <article className={`atlas-action-queue__card is-${item.priority}`}>
      <div className="atlas-action-queue__meta">
        <span className="atlas-action-queue__source">
          {item.source === "squad" ? "Squad" : "Finance"}
        </span>
        <span className={`atlas-dashboard-planning-badge is-${item.priority}`}>
          {item.priority}
        </span>
        <span>{item.confidence} confidence</span>
      </div>
      <h4>{item.title}</h4>
      <p>{item.description}</p>
      {item.profile ? <span className="atlas-action-queue__profile">{item.profile}</span> : null}
      {item.financialImpact.length > 0 ? (
        <div className="atlas-dashboard-financial-impact">
          {item.financialImpact.map((impact) => (
            <span key={impact}>{impact}</span>
          ))}
        </div>
      ) : null}
      {item.players.length > 0 ? (
        <div className="atlas-action-queue__players">
          <span>Players:</span>
          {item.players.map((player) => (
            <PlayerLink
              countryName={player.countryName}
              key={player.id}
              onSelectPlayer={onSelectPlayer}
              playerId={player.id}
            >
              {player.name}
            </PlayerLink>
          ))}
        </div>
      ) : null}
      {item.reasons.length > 0 ? (
        <details>
          <summary>Why this matters</summary>
          <ul>
            {item.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </details>
      ) : null}
      <button className="atlas-action-queue__cta" onClick={handleOpenDestination} type="button">
        {destinationLabel(item.destination)}
      </button>
    </article>
  );
}

function openActionDestination(
  destination: ActionQueueDestination,
  onSelectPlayer: (playerId: string) => void,
  onNavigateToView: (view: ActionQueueView) => void
): void {
  if (destination.kind === "player") {
    onSelectPlayer(destination.playerId);
    return;
  }

  onNavigateToView(destination.view);
}

function destinationLabel(destination: ActionQueueDestination): string {
  if (destination.kind === "player") return "View player";
  return destination.view === "squad" ? "View First Team" : "View Finances";
}
