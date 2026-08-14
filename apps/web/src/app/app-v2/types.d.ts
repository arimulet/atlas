export type V2ViewId =
  | "dashboard"
  | "finances"
  | "squad"
  | "training"
  | "youth"
  | "diagnostics"
  | "player-detail"
  | "squad-economy"
  | "player-development"
  | "squad-market-planning"
  | "youth-pipeline-planning"
  | "real-youth-academy";

export interface V2NavigationItem {
  id: V2ViewId;
  label: string;
  icon: string;
}
