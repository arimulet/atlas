import type { UiVersion } from "@atlas/web/app/ui-version";

export interface AppV2Props {
  uiVersion: UiVersion;
  onUiVersionChange: (version: UiVersion) => void;
}
