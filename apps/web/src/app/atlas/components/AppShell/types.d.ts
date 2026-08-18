import type { ReactNode } from "react";

import type { UiMode } from "@atlas/web/app/ui-mode";
import type { SokkerImporterFormProps } from "../SokkerImporterForm/types";
import type { MainViewId } from "../../routing";

export interface AppShellProps {
  activeView: MainViewId | null;
  children: ReactNode;
  isSokkerImportOpen: boolean;
  onUiModeChange: (version: UiMode) => void;
  onViewChange: (view: MainViewId) => void;
  onCloseSokkerImport: () => void;
  onOpenSokkerImport: () => void;
  onSokkerImport: SokkerImporterFormProps["onImport"];
  navigationKey: string;
  uiMode: UiMode;
}
