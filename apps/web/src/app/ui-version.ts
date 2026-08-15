import type { UiVersion } from "./ui-version/types";

export type { UiVersion } from "./ui-version/types";

export const uiVersionStorageKey = "atlas-ui-version";

export function readUiVersion(): UiVersion {
  const storedVersion = window.localStorage.getItem(uiVersionStorageKey);

  return storedVersion === "v2" ? "v2" : "legacy";
}
