import type { ReactNode } from "react";

import type { UiVersion } from "@atlas/web/app/ui-version";
import type { SokkerImporterFormProps } from "../SokkerImporterForm/types";
import type { V2ViewId } from "../../types";

export interface AppShellProps {
  activeView: V2ViewId;
  children: ReactNode;
  isSokkerImportOpen: boolean;
  onUiVersionChange: (version: UiVersion) => void;
  onViewChange: (view: V2ViewId) => void;
  onCloseSokkerImport: () => void;
  onOpenSokkerImport: () => void;
  onSokkerImport: SokkerImporterFormProps["onImport"];
  uiVersion: UiVersion;
}
