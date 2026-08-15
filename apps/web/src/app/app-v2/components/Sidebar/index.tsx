import { pathForMainView } from "../../routing";
import type { V2NavigationItem } from "../../types";
import { UiVersionSwitch } from "../UiVersionSwitch";
import { SidebarItem } from "../SidebarItem";
import { SidebarProps } from "./types";

const navigationItems: V2NavigationItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "⌂", path: pathForMainView("dashboard") },
  { id: "squad", label: "Squad", icon: "S", path: pathForMainView("squad") },
  { id: "training", label: "Training", icon: "T", path: pathForMainView("training") },
  { id: "youth", label: "Youth", icon: "Y", path: pathForMainView("youth") },
  { id: "finances", label: "Finances", icon: "$", path: pathForMainView("finances") },
  { id: "diagnostics", label: "Diagnostics", icon: "!", path: pathForMainView("diagnostics") }
];

export function Sidebar({ activeView, onUiVersionChange, onViewChange, uiVersion }: SidebarProps) {
  return (
    <aside className="v2-sidebar">
      <div className="v2-sidebar__navigation">
        <p className="v2-sidebar__label">Navigation</p>
        <nav aria-label="ATLAS modules">
          {navigationItems.map((item) => (
            <SidebarItem
              key={item.id}
              item={item}
              isActive={activeView === item.id}
              onSelect={onViewChange}
            />
          ))}
        </nav>
      </div>

      <div className="v2-sidebar__footer">
        <p className="v2-sidebar__label">Interface</p>
        <UiVersionSwitch activeVersion={uiVersion} onChange={onUiVersionChange} />
      </div>
    </aside>
  );
}
