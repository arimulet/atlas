import type { NavigationItem } from "../../types";

export interface SidebarItemProps {
  item: NavigationItem;
  isActive: boolean;
  onSelect: (id: NavigationItem["id"]) => void;
}
