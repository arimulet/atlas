import type { DiagnosticFinding } from "@atlas/web/app/types";
import { useId, useState } from "react";

import { describeDiagnosticsFinding } from "../../view-models/diagnostics-view-model";

interface DiagnosticNotificationsProps {
  diagnostics: readonly DiagnosticFinding[];
  showAll?: boolean;
}

export function DiagnosticNotifications({
  diagnostics,
  showAll = false
}: DiagnosticNotificationsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const displayedDiagnostics = showAll
    ? diagnostics
    : diagnostics.filter(
        (diagnostic) => diagnostic.severity === "high" || diagnostic.severity === "medium"
      );
  const hasDiagnostics = displayedDiagnostics.length > 0;
  const notificationCountLabel =
    displayedDiagnostics.length > 99 ? "99+" : displayedDiagnostics.length.toLocaleString("es-AR");

  const handleToggle = () => {
    setIsOpen((currentValue) => !currentValue);
  };

  return (
    <div className="atlas-diagnostic-notifications">
      <button
        aria-controls={panelId}
        aria-expanded={isOpen}
        aria-label={
          hasDiagnostics
            ? "Notificaciones: " + displayedDiagnostics.length + " hallazgo(s) de diagnóstico"
            : "Notificaciones"
        }
        className="atlas-diagnostic-notifications__button"
        type="button"
        onClick={handleToggle}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
        {hasDiagnostics ? (
          <span className="atlas-diagnostic-notifications__badge" aria-hidden="true">
            {notificationCountLabel}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <section
          className="atlas-diagnostic-notifications__panel"
          id={panelId}
          aria-label="Notificaciones de diagnóstico"
        >
          <header className="atlas-diagnostic-notifications__panel-header">
            <strong>Notificaciones</strong>
            {hasDiagnostics ? <span>{displayedDiagnostics.length} hallazgo(s)</span> : null}
          </header>

          {hasDiagnostics ? (
            <ul className="atlas-diagnostic-notifications__list">
              {displayedDiagnostics.map((diagnostic, index) => {
                const playerName = diagnostic.parameters?.playerName;

                return (
                  <li key={diagnostic.code + "-" + index}>
                    <span
                      className={
                        "atlas-diagnostic-notifications__severity is-" + diagnostic.severity
                      }
                    >
                      {diagnostic.severity}
                    </span>
                    <div>
                      {playerName ? (
                        <strong className="atlas-diagnostic-notifications__subject">
                          {playerName}
                        </strong>
                      ) : null}
                      <p>{describeDiagnosticsFinding(diagnostic)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="atlas-diagnostic-notifications__empty">No hay notificaciones.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
