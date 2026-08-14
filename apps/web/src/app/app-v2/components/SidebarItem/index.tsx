import { SidebarItemProps } from "./types";

export function SidebarItem({ item, isActive, onSelect }: SidebarItemProps) {
  return (
    <button
      type="button"
      className={`v2-sidebar-item${isActive ? " is-active" : ""}`}
      aria-current={isActive ? "page" : undefined}
      onClick={() => onSelect(item.id)}
    >
      <span className="v2-sidebar-item__icon" aria-hidden="true">
        {item.icon}
      </span>
      <span>{item.label}</span>
    </button>
  );
}
