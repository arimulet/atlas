import type { OperationalArea } from "../types";

export interface ModuleGridProps {
  areas: OperationalArea[];
}

export function ModuleGrid({ areas }: ModuleGridProps) {
  return (
    <div className="module-grid">
      {areas.map((area) => (
        <article className={`module-card ${area.status}`} key={area.key}>
          <div className="module-card-heading">
            <h3>{area.label}</h3>
            <span className={`module-status ${area.status}`}>{area.status}</span>
          </div>
          <p>{area.summary}</p>
        </article>
      ))}
    </div>
  );
}
