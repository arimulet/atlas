import type { MainViewId } from "../../routing";

export interface SidebarProps {
  activeView: MainViewId | null;
  onViewChange: (view: MainViewId) => void;
}
