import { pathForMainView } from "../../routing";
import type { NavigationItem } from "../../types";
import { SidebarItem } from "../SidebarItem";
import { SidebarProps } from "./types";

const navigationItems: NavigationItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "⌂", path: pathForMainView("dashboard") },
  { id: "squad", label: "Squad", icon: "S", path: pathForMainView("squad") },
  { id: "training", label: "Training", icon: "T", path: pathForMainView("training") },
  { id: "youth", label: "Youth", icon: "Y", path: pathForMainView("youth") },
  { id: "finances", label: "Finances", icon: "$", path: pathForMainView("finances") },
  { id: "diagnostics", label: "Diagnostics", icon: "!", path: pathForMainView("diagnostics") }
];

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  return (
    <aside className="atlas-sidebar">
      <div className="atlas-sidebar__navigation">
        <p className="atlas-sidebar__label">Navigation</p>
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

    </aside>
  );
}
