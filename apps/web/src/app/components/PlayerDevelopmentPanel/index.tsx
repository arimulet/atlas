import { useState } from "react";

import type { PlayerDevelopmentFindingType } from "@atlas/web/app/types";
import { SummaryItem } from "@atlas/web/app/components/SummaryItem";
import { PlayerDevelopmentPanelProps } from "./types";
import { PlayerDevelopmentCard } from "./components/PlayerDevelopmentCard";
import { Section } from "@atlas/web/app/components/Section";
import { IssueList } from "@atlas/web/app/components/IssueList";

export const PlayerDevelopmentPanel = ({
  playerDevelopment,
  status,
  onBack
}: PlayerDevelopmentPanelProps) => {
  const [evolutionFilter, setEvolutionFilter] = useState<PlayerDevelopmentFindingType | "all">(
    "all"
  );

  if (status === "loading") {
    return <Section description="Cargando desarrollo de jugadores..." />;
  }

  if (status === "error" || !playerDevelopment) {
    return (
      <Section
        tone="error"
        title="Desarrollo de jugadores"
        subtitle="No se pudo cargar el modulo"
        description=">Volver al dashboard e intentar nuevamente."
      >
        <button type="button" onClick={onBack}>
          Volver al dashboard
        </button>
      </Section>
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

      <Section
        title="Alcance"
        subtitle="Evolucion observada de habilidades"
        description="Esta vista compara habilidades visibles entre snapshots historicos. La prioridad de entrenamiento aparece como contexto manual y no como prueba causal de las mejoras."
      />

      <section className="development-columns">
        <Section title="Observado" subtitle="Historial disponible">
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
        </Section>

        <Section title="Manual" subtitle="Contexto del club">
          <dl className="summary-grid">
            <SummaryItem
              label="training.priority"
              value={playerDevelopment.manual.trainingPriority}
            />
            <SummaryItem label="Causalidad" value="No atribuida" />
          </dl>
        </Section>
      </section>

      {playerDevelopment.warnings.length > 0 ? (
        <Section title="Advertencias del modulo" tone="warning">
          <IssueList issues={playerDevelopment.warnings} />
        </Section>
      ) : null}

      <Section title="Derivado por jugador" subtitle="Evolucion reciente">
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
      </Section>
    </section>
  );
};

function labelFilter(filter: PlayerDevelopmentFindingType | "all"): string {
  if (filter === "all") return "Todos";
  if (filter === "improvement") return "Mejora";
  if (filter === "stagnation") return "Estancamiento";
  if (filter === "decline") return "Deterioro";
  return "Sin datos";
}
