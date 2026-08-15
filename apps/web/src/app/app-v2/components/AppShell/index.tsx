import { Header } from "../Header";
import { MainContent } from "../MainContent";
import { SokkerImportModal } from "../SokkerImportModal";
import { Sidebar } from "../Sidebar";
import { AppShellProps } from "./types";

export function AppShell({
  activeView,
  children,
  isSokkerImportOpen,
  onUiVersionChange,
  onViewChange,
  onCloseSokkerImport,
  onOpenSokkerImport,
  onSokkerImport,
  uiVersion,
  navigationKey
}: AppShellProps) {
  return (
    <div className="atlas-v2 v2-app-shell">
      <Header onOpenSokkerImporter={onOpenSokkerImport} />
      <Sidebar
        activeView={activeView}
        onViewChange={onViewChange}
        uiVersion={uiVersion}
        onUiVersionChange={onUiVersionChange}
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
