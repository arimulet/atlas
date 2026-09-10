import type { MainViewId } from "@/app/routing";

export interface SidebarProps {
  activeView: MainViewId | null;
  diagnosticAlertCount: number;
  onViewChange: (view: MainViewId) => void;
}
