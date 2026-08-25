import { Header } from "../Header";
import { MainContent } from "../MainContent";
import { SokkerImportModal } from "../SokkerImportModal";
import { Sidebar } from "../Sidebar";
import { AppShellProps } from "./types";

export function AppShell({
  activeView,
  children,
  diagnosticAlertCount,
  isSokkerImportOpen,
  onViewChange,
  onCloseSokkerImport,
  onOpenSokkerImport,
  onSokkerImport,
  navigationKey
}: AppShellProps) {
  return (
    <div className="atlas atlas-app-shell">
      <Header onOpenSokkerImporter={onOpenSokkerImport} />
      <Sidebar
        activeView={activeView}
        diagnosticAlertCount={diagnosticAlertCount}
        onViewChange={onViewChange}
      />
      <MainContent navigationKey={navigationKey}>{children}</MainContent>
      <SokkerImportModal
        isOpen={isSokkerImportOpen}
        onClose={onCloseSokkerImport}
        onImport={onSokkerImport}
      />
    </div>
  );
}
