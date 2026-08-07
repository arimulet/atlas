import type { SquadMarketPlanning } from "../../types";

export interface SquadMarketPlanningPanelProps {
  squadMarketPlanning: SquadMarketPlanning | null;
  status: "idle" | "loading" | "ready" | "error";
  onBack: () => void;
}
