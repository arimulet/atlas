import {
  LayoutDashboard,
  Users,
  UserCog,
  GraduationCap,
  CircleDollarSign,
  Activity,
  LineChart,
  Calculator
} from "lucide-react";
import { pathForMainView } from "@/app/routing";
import type { NavigationGroup } from "@/app/types";
import { SidebarItem } from "../SidebarItem";
import { SidebarProps } from "./types";

const ICON_SIZE = 20;
const navigationGroups: NavigationGroup[] = [
  {
    id: "squad",
    label: "Squad",
    items: [
      {
        id: "squad",
        label: "First Team",
        icon: <Users size={ICON_SIZE} />,
        path: pathForMainView("squad")
      },
      {
        id: "player-decisions",
        label: "Player Decisions",
        icon: <UserCog size={ICON_SIZE} />,
        path: pathForMainView("player-decisions")
      },
      {
        id: "youth",
        label: "Youth",
        icon: <GraduationCap size={ICON_SIZE} />,
        path: pathForMainView("youth")
      },
      {
        id: "youth-performances",
        label: "Performances",
        icon: <LineChart size={ICON_SIZE} />,
        path: pathForMainView("youth-performances")
      }
    ]
  },
  {
    id: "tools",
    label: "Tools",
    items: [
      {
        id: "insights",
        label: "Insights",
        icon: <LayoutDashboard size={ICON_SIZE} />,
        path: pathForMainView("insights")
      },
      {
        id: "finances",
        label: "Finances",
        icon: <CircleDollarSign size={ICON_SIZE} />,
        path: pathForMainView("finances")
      },
      {
        id: "investment-simulator",
        label: "Investment Simulator",
        icon: <Calculator size={ICON_SIZE} />,
        path: pathForMainView("investment-simulator")
      },
      {
        id: "diagnostics",
        label: "Diagnostics",
        icon: <Activity size={ICON_SIZE} />,
        path: pathForMainView("diagnostics")
      }
    ]
  }
];

export function Sidebar({ activeView, diagnosticAlertCount, onViewChange }: SidebarProps) {
  return (
    <aside className="atlas-sidebar">
      <div className="atlas-sidebar__navigation">
        <nav aria-label="ATLAS modules">
          {navigationGroups.map((group) => (
            <div key={group.id} className="atlas-sidebar__group">
              <p className="atlas-sidebar__label">{group.label}</p>
              {group.items.map((item) => (
                <SidebarItem
                  key={item.id}
                  item={item}
                  badgeCount={item.id === "diagnostics" ? diagnosticAlertCount : undefined}
                  isActive={activeView === item.id}
                  onSelect={onViewChange}
                />
              ))}
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
