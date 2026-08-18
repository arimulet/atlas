import { UiModeSwitchProps } from "./types";

export function UiModeSwitch({
  activeMode,
  onChange,
  variant = "legacy"
}: UiModeSwitchProps) {
  return (
    <div
      className={`${variant === "canonical" ? "atlas-ui-mode-switch" : "ui-mode-switch"}`}
      aria-label="Interface mode"
    >
      <button
        type="button"
        className={activeMode === "legacy" ? "active" : ""}
        aria-pressed={activeMode === "legacy"}
        onClick={() => onChange("legacy")}
      >
        Legacy UI
      </button>
      <button
        type="button"
        className={activeMode === "canonical" ? "active" : ""}
        aria-pressed={activeMode === "canonical"}
        onClick={() => onChange("canonical")}
      >
        ATLAS UI
      </button>
    </div>
  );
}
