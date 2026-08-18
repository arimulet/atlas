import { Header } from "../Header";
import { MainContent } from "../MainContent";
import { SokkerImportModal } from "../SokkerImportModal";
import { Sidebar } from "../Sidebar";
import { AppShellProps } from "./types";

export function AppShell({
  activeView,
  children,
  isSokkerImportOpen,
  onUiModeChange,
  onViewChange,
  onCloseSokkerImport,
  onOpenSokkerImport,
  onSokkerImport,
  uiMode,
  navigationKey
}: AppShellProps) {
  return (
    <div className="atlas atlas-app-shell">
      <Header onOpenSokkerImporter={onOpenSokkerImport} />
      <Sidebar
        activeView={activeView}
        onViewChange={onViewChange}
        uiMode={uiMode}
        onUiModeChange={onUiModeChange}
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
