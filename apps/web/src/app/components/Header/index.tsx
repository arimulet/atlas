import { DiagnosticNotifications } from "./DiagnosticNotifications";
import { HeaderProps } from "./types";

export function Header({ diagnostics, onOpenSokkerImporter }: HeaderProps) {
  return (
    <header className="atlas-header">
      <div className="atlas-brand" aria-label="ATLAS">
        <span className="atlas-brand__mark" aria-hidden="true">
          A
        </span>
        <span className="atlas-brand__name">ATLAS</span>
      </div>

      <div className="atlas-header__tools">
        <DiagnosticNotifications diagnostics={diagnostics} />
        <button type="button" className="atlas-import-button" onClick={onOpenSokkerImporter}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M20 11a8 8 0 0 0-14.7-4.3L4 8" />
            <path d="M4 4v4h4" />
            <path d="M4 13a8 8 0 0 0 14.7 4.3L20 16" />
            <path d="M20 20v-4h-4" />
          </svg>
          <span>Actualizar</span>
        </button>
      </div>
    </header>
  );
}