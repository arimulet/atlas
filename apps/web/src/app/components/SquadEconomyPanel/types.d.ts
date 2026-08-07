import type {  SquadEconomy} from "../../types";

export interface SquadEconomyPanelProps {
  squadEconomy: SquadEconomy | null;
  status: "idle" | "loading" | "ready" | "error";
  onBack: () => void;
}
