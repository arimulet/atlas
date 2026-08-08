import { ModuleCardProps } from "./types";

export const ModuleCard = ({ status = "available", label, summary, children }: ModuleCardProps) => (
  <article className={`module-card ${status}`}>
    <div className="module-card-heading">
      <h3>{label}</h3>
      <span className={`module-status ${status}`}>{status}</span>
    </div>
    <p>{summary}</p>
    {children}
  </article>
);
