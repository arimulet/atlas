import {
  LayoutDashboard,
  Users,
  Dumbbell,
  UserCog,
  GraduationCap,
  CircleDollarSign,
  Activity,
  LineChart
} from "lucide-react";
import { pathForMainView } from "../../routing";
import type { NavigationGroup } from "../../types";
import { SidebarItem } from "../SidebarItem";
import { SidebarProps } from "./types";

const ICON_SIZE = 20;
const navigationGroups: NavigationGroup[] = [
  {
    id: "general",
    label: "General",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: <LayoutDashboard size={ICON_SIZE} />,
        path: pathForMainView("dashboard")
      }
    ]
  },
  {
    id: "first-team",
    label: "Primer Equipo",
    items: [
      {
        id: "squad",
        label: "Squad",
        icon: <Users size={ICON_SIZE} />,
        path: pathForMainView("squad")
      },
      {
        id: "training",
        label: "Training",
        icon: <Dumbbell size={ICON_SIZE} />,
        path: pathForMainView("training")
      },
      {
        id: "player-decisions",
        label: "Player Decisions",
        icon: <UserCog size={ICON_SIZE} />,
        path: pathForMainView("player-decisions")
      }
    ]
  },
  {
    id: "academy",
    label: "Academia",
    items: [
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
    id: "admin",
    label: "Administración",
    items: [
      {
        id: "finances",
        label: "Finances",
        icon: <CircleDollarSign size={ICON_SIZE} />,
        path: pathForMainView("finances")
      }
    ]
  },
  {
    id: "system",
    label: "Sistema",
    items: [
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
            <div key={group.id} className="atlas-sidebar__group" style={{ marginBottom: "1.5rem" }}>
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
