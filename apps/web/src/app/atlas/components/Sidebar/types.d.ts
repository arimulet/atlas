import type { UiMode } from "@atlas/web/app/ui-mode";
import type { MainViewId } from "../../routing";

export interface SidebarProps {
  activeView: MainViewId | null;
  onUiModeChange: (version: UiMode) => void;
  onViewChange: (view: MainViewId) => void;
  uiMode: UiMode;
}
