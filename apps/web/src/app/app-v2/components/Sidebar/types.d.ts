import type { UiVersion } from "@atlas/web/app/ui-version";
import type { V2MainViewId } from "../../routing";

export interface SidebarProps {
  activeView: V2MainViewId | null;
  onUiVersionChange: (version: UiVersion) => void;
  onViewChange: (view: V2MainViewId) => void;
  uiVersion: UiVersion;
}
