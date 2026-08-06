import type { OperationalArea } from "../types";

export interface ModuleGridProps {
  areas: OperationalArea[];
  onOpenSquadEconomy?: () => void;
  onOpenPlayerDevelopment?: () => void;
  onOpenSquadMarketPlanning?: () => void;
  onOpenYouthPipelinePlanning?: () => void;
}

export function ModuleGrid({
  areas,
  onOpenSquadEconomy,
  onOpenPlayerDevelopment,
  onOpenSquadMarketPlanning,
  onOpenYouthPipelinePlanning
}: ModuleGridProps) {
  return (
    <div className="module-grid">
      {areas.map((area) => (
        <article className={`module-card ${area.status}`} key={area.key}>
          <div className="module-card-heading">
            <h3>{area.label}</h3>
            <span className={`module-status ${area.status}`}>{area.status}</span>
          </div>
          <p>{area.summary}</p>
          {area.key === "squad-economy" && area.status === "available" ? (
            <button type="button" onClick={onOpenSquadEconomy}>
              Abrir Economia de plantilla
            </button>
          ) : null}
          {area.key === "player-development" && area.status === "available" ? (
            <button type="button" onClick={onOpenPlayerDevelopment}>
              Abrir desarrollo
            </button>
          ) : null}
          {area.key === "squad-market-planning" && area.status === "available" ? (
            <button type="button" onClick={onOpenSquadMarketPlanning}>
              Abrir planificacion
            </button>
          ) : null}
          {area.key === "youth-pipeline-planning" && area.status === "available" ? (
            <button type="button" onClick={onOpenYouthPipelinePlanning}>
              Abrir pipeline juvenil senior
            </button>
          ) : null}
        </article>
      ))}
    </div>
  );
}
