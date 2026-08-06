import type { DiagnosticAssumption, DiagnosticTrace } from "../types";

export interface TraceListProps {
  title: string;
  traces: DiagnosticTrace[];
}

export function TraceList({ title, traces }: TraceListProps) {
  return (
    <div className="detail-block">
      <h4>{title}</h4>
      <ul>
        {traces.map((trace) => (
          <li key={`${trace.kind}-${trace.label}-${trace.value}`}>
            <span className={`trace-kind ${trace.kind}`}>{trace.kind}</span>
            <span>
              {trace.label}
              {trace.value !== null ? `: ${trace.value}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AssumptionList({ assumptions }: { assumptions: DiagnosticAssumption[] }) {
  return (
    <div className="detail-block">
      <h4>Assumptions</h4>
      <ul>
        {assumptions.map((assumption) => (
          <li key={assumption.code}>
            <span className="trace-kind assumed">{assumption.traceKind}</span>
            <span>{assumption.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
