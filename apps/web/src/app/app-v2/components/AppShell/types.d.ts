import type { ReactNode } from "react";

import type { UiVersion } from "@atlas/web/app/ui-version";
import type { SokkerImporterFormProps } from "../SokkerImporterForm/types";
import type { V2MainViewId } from "../../routing";

export interface AppShellProps {
  activeView: V2MainViewId | null;
  children: ReactNode;
  isSokkerImportOpen: boolean;
  onUiVersionChange: (version: UiVersion) => void;
  onViewChange: (view: V2MainViewId) => void;
  onCloseSokkerImport: () => void;
  onOpenSokkerImport: () => void;
  onSokkerImport: SokkerImporterFormProps["onImport"];
  navigationKey: string;
  uiVersion: UiVersion;
}
