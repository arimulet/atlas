import type { SquadMarketPlanning } from "@atlas/web/app/types";

export interface SquadMarketPlanningPanelProps {
  squadMarketPlanning: SquadMarketPlanning | null;
  status: "idle" | "loading" | "ready" | "error";
  onBack: () => void;
}
