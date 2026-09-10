import type { NavigationItem } from "../../types";

export interface SidebarItemProps {
  badgeCount?: number;
  item: NavigationItem;
  isActive: boolean;
  onSelect: (id: NavigationItem["id"]) => void;
}
