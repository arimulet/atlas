import type { YouthPipelinePlanning } from "../../types";

export interface YouthPipelinePlanningPanelProps {
  youthPipelinePlanning: YouthPipelinePlanning | null;
  status: "idle" | "loading" | "ready" | "error";
  onBack: () => void;
}