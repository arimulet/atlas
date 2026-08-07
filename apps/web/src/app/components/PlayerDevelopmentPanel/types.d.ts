import type { PlayerDevelopment } from "@atlas/web/app/types";

export interface PlayerDevelopmentPanelProps {
  playerDevelopment: PlayerDevelopment | null;
  status: "idle" | "loading" | "ready" | "error";
  onBack: () => void;
}