import type { V2NavigationItem } from "../../types";

export interface SidebarItemProps {
  item: V2NavigationItem;
  isActive: boolean;
  onSelect: (id: V2NavigationItem["id"]) => void;
}
