import type { SquadEconomy } from "@atlas/web/app/types";

export interface SquadEconomyPanelProps {
  squadEconomy: SquadEconomy | null;
  status: "idle" | "loading" | "ready" | "error";
  onBack: () => void;
}
