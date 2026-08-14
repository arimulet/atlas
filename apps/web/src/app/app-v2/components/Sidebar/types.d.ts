import type { UiVersion } from "@atlas/web/app/ui-version";
import type { V2ViewId } from "../../types";

export interface SidebarProps {
  activeView: V2ViewId;
  onUiVersionChange: (version: UiVersion) => void;
  onViewChange: (view: V2ViewId) => void;
  uiVersion: UiVersion;
}
