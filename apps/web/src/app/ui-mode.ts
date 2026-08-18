import type { UiMode } from "./ui-mode/types";

export type { UiMode } from "./ui-mode/types";

export const uiModeStorageKey = "atlas-ui-mode";

const legacyUiVersionStorageKey = "atlas-ui-version";

export function readUiMode(): UiMode {
  const storedMode =
    window.localStorage.getItem(uiModeStorageKey) ??
    window.localStorage.getItem(legacyUiVersionStorageKey);

  return storedMode === "legacy" ? "legacy" : "canonical";
}
