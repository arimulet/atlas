import { SidebarItemProps } from "./types";

export function SidebarItem({ badgeCount, item, isActive, onSelect }: SidebarItemProps) {
  return (
    <a
      href={item.path}
      className={`atlas-sidebar-item${isActive ? " is-active" : ""}`}
      aria-current={isActive ? "page" : undefined}
      onClick={(event) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }

        event.preventDefault();
        onSelect(item.id);
      }}
    >
      <span className="atlas-sidebar-item__icon" aria-hidden="true">
        {item.icon}
      </span>
      <span>{item.label}</span>
      {badgeCount && badgeCount > 0 ? (
        <span className="atlas-sidebar-item__badge" aria-label={badgeCount + " diagnostic alerts"}>
          {badgeCount}
        </span>
      ) : null}
    </a>
  );
}
