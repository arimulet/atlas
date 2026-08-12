import type { YouthPipelinePlanning } from "@atlas/web/app/types";

export interface YouthPipelinePlanningPanelProps {
  youthPipelinePlanning: YouthPipelinePlanning | null;
  status: "idle" | "loading" | "ready" | "error";
  onBack: () => void;
}