import type { MainViewId } from "./routing";

export type ViewId = MainViewId | "player-detail";

export interface NavigationItem {
  id: MainViewId;
  label: string;
  icon: string;
  path: string;
}
