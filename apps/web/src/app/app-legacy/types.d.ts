import type { UiVersion } from "@atlas/web/app/ui-version";

export interface AppLegacyProps {
  uiVersion: UiVersion;
  onUiVersionChange: (version: UiVersion) => void;
}
