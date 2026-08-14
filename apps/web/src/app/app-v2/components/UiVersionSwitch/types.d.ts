import type { UiVersion } from "@atlas/web/app/ui-version";

export interface UiVersionSwitchProps {
  activeVersion: UiVersion;
  onChange: (version: UiVersion) => void;
}
