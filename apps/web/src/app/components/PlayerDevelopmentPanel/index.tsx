import { useState } from "react";

import type { PlayerDevelopmentFindingType } from "../../types";
import { IssuePanel } from "../IssuePanel";
import { SummaryItem } from "../SummaryItem";
import { PlayerDevelopmentPanelProps } from "./types";
import { PlayerDevelopmentCard } from "./components/PlayerDevelopmentCard";

export const PlayerDevelopmentPanel = ({
  playerDevelopment,
  status,
  onBack
}: PlayerDevelopmentPanelProps) => {
  const [evolutionFilter, setEvolutionFilter] = useState<PlayerDevelopmentFindingType | "all">(
    "all"
  );

  if (status === "loading") {
    return (
      <section className="panel">
        <p className="loading">Cargando desarrollo de jugadores...</p>
      </section>
    );
  }

  if (status === "error" || !playerDevelopment) {
    return (
      <section className="panel issue-panel error">
        <div className="panel-heading">
          <p className="eyebrow">Desarrollo de jugadores</p>
          <h2>No se pudo cargar el modulo</h2>
        </div>
        <p className="muted">Volver al dashboard e intentar nuevamente.</p>
        <button type="button" onClick={onBack}>
          Volver al dashboard
        </button>
      </section>
    );
  }

  const visiblePlayers = playerDevelopment.derived.players.filter((player) => {
    if (evolutionFilter === "all") {
      return true;
    }

    return player.findings.some((finding) => finding.type === evolutionFilter);
  });

  return (
    <section className="player-development-view">
      <div className="module-topbar">
        <div>
          <p className="eyebrow">Modulo</p>
          <h2>Desarrollo de jugadores</h2>
        </div>
        <button type="button" onClick={onBack}>
          Volver al dashboard
        </button>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <p className="eyebrow">Alcance</p>
          <h2>Evolucion observada de habilidades</h2>
        </div>
        <p className="muted">
          Esta vista compara habilidades visibles entre snapshots historicos. La prioridad de
          entrenamiento aparece como contexto manual y no como prueba causal de las mejoras.
        </p>
      </section>

      <section className="development-columns">
        <section className="panel">
          <div className="panel-heading">
            <p className="eyebrow">Observado</p>
            <h2>Historial disponible</h2>
          </div>
          <dl className="summary-grid">
            <SummaryItem label="Snapshots" value={playerDevelopment.snapshotCount.toString()} />
            <SummaryItem
              label="Ultimo snapshot"
              value={playerDevelopment.observed.latestSnapshotDate ?? "No disponible"}
            />
            <SummaryItem
              label="Jugadores"
              value={playerDevelopment.observed.players.length.toString()}
            />
          </dl>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <p className="eyebrow">Manual</p>
            <h2>Contexto del club</h2>
          </div>
          <dl className="summary-grid">
            <SummaryItem
              label="training.priority"
              value={playerDevelopment.manual.trainingPriority}
            />
            <SummaryItem label="Causalidad" value="No atribuida" />
          </dl>
        </section>
      </section>

      {playerDevelopment.warnings.length > 0 ? (
        <IssuePanel
          title="Advertencias del modulo"
          tone="warning"
          issues={playerDevelopment.warnings.map((warning) => ({
            path: warning.code,
            message: warning.message
          }))}
        />
      ) : null}

      <section className="panel">
        <div className="panel-heading">
          <p className="eyebrow">Derivado por jugador</p>
          <h2>Evolucion reciente</h2>
        </div>
        <div className="filter-row" aria-label="Filtrar por evolucion">
          {(["all", "improvement", "stagnation", "decline", "insufficient_data"] as const).map(
            (option) => (
              <button
                className={
                  evolutionFilter === option ? "secondary-button active" : "secondary-button"
                }
                key={option}
                type="button"
                onClick={() => setEvolutionFilter(option)}
              >
                {labelFilter(option)}
              </button>
            )
          )}
        </div>
        <div className="development-list">
          {visiblePlayers.map((player) => (
            <PlayerDevelopmentCard key={player.playerId ?? player.name} player={player} />
          ))}
        </div>
      </section>
    </section>
  );
}


function labelFilter(filter: PlayerDevelopmentFindingType | "all"): string {
  if (filter === "all") return "Todos";
  if (filter === "improvement") return "Mejora";
  if (filter === "stagnation") return "Estancamiento";
  if (filter === "decline") return "Deterioro";
  return "Sin datos";
}





