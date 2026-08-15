import type { V2MainViewId } from "./routing";

export type V2ViewId = V2MainViewId | "player-detail";

export interface V2NavigationItem {
  id: V2MainViewId;
  label: string;
  icon: string;
  path: string;
}
