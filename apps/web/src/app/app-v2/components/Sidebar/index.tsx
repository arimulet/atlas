import { UiVersionSwitch } from "../UiVersionSwitch";
import type { V2NavigationItem } from "../../types";
import { SidebarItem } from "../SidebarItem";
import { SidebarProps } from "./types";

const navigationItems: V2NavigationItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "⌂" },
  { id: "squad-economy", label: "Squad Economy", icon: "◇" },
  { id: "player-development", label: "Player Development", icon: "♙" },
  { id: "squad-market-planning", label: "Squad Market Planning", icon: "↗" },
  { id: "youth-pipeline-planning", label: "Youth Pipeline Planning", icon: "◈" },
  { id: "real-youth-academy", label: "Youth Academy", icon: "⚽" }
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
