import type { PlayerDevelopment } from "../../types";

export interface PlayerDevelopmentPanelProps {
  playerDevelopment: PlayerDevelopment | null;
  status: "idle" | "loading" | "ready" | "error";
  onBack: () => void;
}