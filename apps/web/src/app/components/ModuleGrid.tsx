import type { OperationalArea } from "../types";

export interface ModuleGridProps {
  areas: OperationalArea[];
  onOpenSquadEconomy?: () => void;
}

export function ModuleGrid({ areas, onOpenSquadEconomy }: ModuleGridProps) {
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
        </article>
      ))}
    </div>
  );
}
