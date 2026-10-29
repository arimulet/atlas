import type { SquadPlanningHorizon, SquadPlanningRecommendationPriority } from "@atlas/domain";
import type { FinancialRecommendationViewModel } from "@/app/features/financialStrategy/financial-strategy-view-model";
import type { SquadPlanningBundle } from "@/app/types";
import { createSquadPriorityActionsViewModel } from "@/components/Squad/squad-planning-view-model";

export type ActionQueueSource = "squad" | "finance";
export type ActionQueueView = "squad" | "finances";

export interface ActionQueuePlayer {
  id: string;
  name: string;
  countryName: string | null;
}

export type ActionQueueDestination =
  { kind: "player"; playerId: string } | { kind: "view"; view: ActionQueueView };

export interface ActionQueueItem {
  id: string;
  source: ActionQueueSource;
  priority: SquadPlanningRecommendationPriority;
  horizon: SquadPlanningHorizon;
  confidence: string;
  title: string;
  description: string;
  reasons: string[];
  financialImpact: string[];
  profile: string | null;
  players: ActionQueuePlayer[];
  destination: ActionQueueDestination;
}

export interface CreateActionQueueInput {
  squadPlanning: SquadPlanningBundle | null;
  financialRecommendations: readonly FinancialRecommendationViewModel[];
}

export const ACTION_QUEUE_INITIAL_LIMIT = 5;

const PRIORITY_ORDER: Record<SquadPlanningRecommendationPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3
};

const HORIZON_ORDER: Record<SquadPlanningHorizon, number> = {
  current: 0,
  next_season: 1,
  medium_term: 2
};

export function createActionQueueItems({
  squadPlanning,
  financialRecommendations
}: CreateActionQueueInput): ActionQueueItem[] {
  const squadItems = squadPlanning ? createSquadActionQueueItems(squadPlanning) : [];
  const financialItems = financialRecommendations
    .filter(
      (recommendation) =>
        recommendation.type !== "maintain_position" && recommendation.type !== "monitor"
    )
    .map(createFinancialActionQueueItem);

  return [...squadItems, ...financialItems].sort(compareActionQueueItems);
}

export function visibleActionQueueItems(
  items: readonly ActionQueueItem[],
  isExpanded: boolean
): ActionQueueItem[] {
  return isExpanded ? [...items] : items.slice(0, ACTION_QUEUE_INITIAL_LIMIT);
}

export function groupActionQueueItems(
  items: readonly ActionQueueItem[]
): Array<{ horizon: SquadPlanningHorizon; items: ActionQueueItem[] }> {
  return (["current", "next_season", "medium_term"] as const)
    .map((horizon) => ({
      horizon,
      items: items.filter((item) => item.horizon === horizon)
    }))
    .filter((group) => group.items.length > 0);
}

function createSquadActionQueueItems(planning: SquadPlanningBundle): ActionQueueItem[] {
  const players = new Map(
    planning.assessment.depthPlayers.map((player) => [
      String(player.playerId),
      {
        id: String(player.playerId),
        name: player.playerName || `Player ${player.playerId}`,
        countryName: player.countryName ?? null
      }
    ])
  );

  return createSquadPriorityActionsViewModel(planning)
    .filter((recommendation) => recommendation.type !== "monitor")
    .map((recommendation) => {
      const actionPlayers = recommendation.playerIds.map(
        (playerId): ActionQueuePlayer =>
          players.get(playerId) ?? {
            id: playerId,
            name: `Player ${playerId}`,
            countryName: null
          }
      );
      const primaryPlayerId = recommendation.targetPlayerId ?? recommendation.playerIds[0] ?? null;

      return {
        id: `squad-${recommendation.id}`,
        source: "squad",
        priority: recommendation.priority,
        horizon: recommendation.horizon,
        confidence: recommendation.confidence,
        title: recommendation.title,
        description: recommendation.description,
        reasons: recommendation.reasons,
        financialImpact: [],
        profile: recommendation.profileLabel,
        players: actionPlayers,
        destination: primaryPlayerId
          ? { kind: "player", playerId: primaryPlayerId }
          : { kind: "view", view: "squad" }
      };
    });
}

function createFinancialActionQueueItem(
  recommendation: FinancialRecommendationViewModel
): ActionQueueItem {
  const players = recommendation.playerIds.map((playerId, index) => ({
    id: String(playerId),
    name: recommendation.playerNames[index] ?? `Player ${playerId}`,
    countryName: null
  }));
  const primaryPlayerId = players[0]?.id ?? null;

  return {
    id: `finance-${recommendation.id}`,
    source: "finance",
    priority: recommendation.priorityRaw,
    horizon: recommendation.horizonRaw,
    confidence: recommendation.confidence,
    title: recommendation.title,
    description: recommendation.description,
    reasons: recommendation.reasons,
    financialImpact: recommendation.financialImpact,
    profile: recommendation.profile,
    players,
    destination: primaryPlayerId
      ? { kind: "player", playerId: primaryPlayerId }
      : { kind: "view", view: "finances" }
  };
}

function compareActionQueueItems(left: ActionQueueItem, right: ActionQueueItem): number {
  return (
    PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority] ||
    HORIZON_ORDER[left.horizon] - HORIZON_ORDER[right.horizon] ||
    left.title.localeCompare(right.title)
  );
}
