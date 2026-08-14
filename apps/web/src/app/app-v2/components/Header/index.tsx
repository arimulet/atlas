import { HeaderProps } from "./types";

export function Header({ onOpenSokkerImporter }: HeaderProps) {
  return (
    <header className="v2-header">
      <div className="v2-brand" aria-label="ATLAS">
        <span className="v2-brand__mark" aria-hidden="true">
          A
        </span>
        <span className="v2-brand__name">ATLAS</span>
      </div>

      <div className="v2-header__tools">
        <button type="button" className="atlas-v2-import-button" onClick={onOpenSokkerImporter}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M20 11a8 8 0 0 0-14.7-4.3L4 8" />
            <path d="M4 4v4h4" />
            <path d="M4 13a8 8 0 0 0 14.7 4.3L20 16" />
            <path d="M20 20v-4h-4" />
          </svg>
          <span>Actualizar</span>
        </button>
        <label className="v2-search">
          <span className="v2-search__icon" aria-hidden="true">
            ⌕
          </span>
          <span className="sr-only">Search</span>
          <input type="search" placeholder="Search..." disabled />
        </label>
        <button type="button" className="v2-icon-button" aria-label="Notifications" disabled>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
            <path d="M10 21h4" />
          </svg>
        </button>
        <button type="button" className="v2-avatar" aria-label="Profile" disabled>
          AT
        </button>
      </div>
    </header>
  );
}
