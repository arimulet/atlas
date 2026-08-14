import { Header } from "../Header";
import { MainContent } from "../MainContent";
import { Sidebar } from "../Sidebar";
import { AppShellProps } from "./types";

export function AppShell({
  activeView,
  children,
  onUiVersionChange,
  onViewChange,
  uiVersion
}: AppShellProps) {
  return (
    <div className="v2-app-shell">
      <Header />
      <Sidebar
        activeView={activeView}
        onViewChange={onViewChange}
        uiVersion={uiVersion}
        onUiVersionChange={onUiVersionChange}
      />
      <MainContent>{children}</MainContent>
    </div>
  );
}
