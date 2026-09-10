import type { NavigationItem } from "@/app/types";

export interface SidebarItemProps {
  badgeCount?: number;
  item: NavigationItem;
  isActive: boolean;
  onSelect: (id: NavigationItem["id"]) => void;
}
