import type { UiMode } from "@atlas/web/app/ui-mode";

export interface AtlasAppProps {
  uiMode: UiMode;
  onUiModeChange: (version: UiMode) => void;
}
