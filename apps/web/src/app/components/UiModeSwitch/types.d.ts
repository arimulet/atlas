import type { UiMode } from "@atlas/web/app/ui-mode";

export interface UiModeSwitchProps {
  activeMode: UiMode;
  onChange: (mode: UiMode) => void;
  variant?: "legacy" | "canonical";
}
