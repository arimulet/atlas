import { UiVersionSwitchProps } from "./types";

export function UiVersionSwitch({ activeVersion, onChange }: UiVersionSwitchProps) {
  return (
    <div className="ui-version-switch" aria-label="Interface version">
      <button
        type="button"
        className={activeVersion === "legacy" ? "active" : ""}
        aria-pressed={activeVersion === "legacy"}
        onClick={() => onChange("legacy")}
      >
        Legacy UI
      </button>
      <button
        type="button"
        className={activeVersion === "v2" ? "active" : ""}
        aria-pressed={activeVersion === "v2"}
        onClick={() => onChange("v2")}
      >
        New UI
      </button>
    </div>
  );
}
