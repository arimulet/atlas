import type { MainViewId } from "../../routing";

export interface SidebarProps {
  activeView: MainViewId | null;
  diagnosticAlertCount: number;
  onViewChange: (view: MainViewId) => void;
}
