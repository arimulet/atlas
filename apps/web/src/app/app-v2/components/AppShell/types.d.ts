import type { ReactNode } from "react";

import type { UiVersion } from "@atlas/web/app/ui-version";
import type { V2ViewId } from "../../types";

export interface AppShellProps {
  activeView: V2ViewId;
  children: ReactNode;
  onUiVersionChange: (version: UiVersion) => void;
  onViewChange: (view: V2ViewId) => void;
  uiVersion: UiVersion;
}
