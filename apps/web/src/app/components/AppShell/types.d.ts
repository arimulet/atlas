import type { ReactNode } from "react";

import type { SokkerImporterFormProps } from "../SokkerImporterForm/types";
import type { MainViewId } from "../../routing";
import type { DiagnosticFinding } from "@atlas/web/app/types";

export interface AppShellProps {
  activeView: MainViewId | null;
  children: ReactNode;
  diagnostics: DiagnosticFinding[];
  isSokkerImportOpen: boolean;
  onViewChange: (view: MainViewId) => void;
  onCloseSokkerImport: () => void;
  onOpenSokkerImport: () => void;
  onSokkerImport: SokkerImporterFormProps["onImport"];
  navigationKey: string;
}
